import { Component, OnInit, OnDestroy, inject, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, AlertController, ToastController } from '@ionic/angular';
import { Subscription, forkJoin, from } from 'rxjs';

import { CartService, CartItem } from '../../core/cart/cart.service';
import { ORDER_REPOSITORY, OrderRepository } from '../../core/repositories/order.repository';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss'],
  standalone: false
})
export class CartComponent implements OnInit, OnDestroy {
  cartItems: CartItem[] = [];
  cartTotal = 0;
  cartCount = 0;

  // Lista estática de puntos de encuentro en el campus
  deliverySpots: string[] = [
    'Biblioteca Pabellón A (1er Piso)',
    'Cafetería Principal - Patio Central',
    'Auditorio Central - Entrada',
    'Lobby de Ingreso Pabellón B',
    'Zona de Áreas Verdes - Bancas Centrales',
    'Portón de Ingreso Principal'
  ];
  selectedSpot: string = 'Biblioteca Pabellón A (1er Piso)';

  private subscriptions = new Subscription();

  private cartService = inject(CartService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private loadingCtrl = inject(LoadingController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  constructor(
    @Inject(ORDER_REPOSITORY) private orderRepository: OrderRepository
  ) {}

  ngOnInit() {
    // Escuchar los items del carrito
    this.subscriptions.add(
      this.cartService.cartItems$.subscribe(items => {
        this.cartItems = items;
      })
    );

    // Escuchar el total
    this.subscriptions.add(
      this.cartService.getCartTotal$().subscribe(total => {
        this.cartTotal = total;
      })
    );

    // Escuchar la cantidad total
    this.subscriptions.add(
      this.cartService.getCartCount$().subscribe(count => {
        this.cartCount = count;
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  updateQuantity(productId: string, quantity: number) {
    const success = this.cartService.updateQuantity(productId, quantity);
    if (!success) {
      this.showToast('No hay suficiente stock disponible de este producto.', 'warning');
    }
  }

  removeItem(productId: string) {
    this.cartService.removeFromCart(productId);
    this.showToast('Producto eliminado del carrito.', 'medium');
  }

  async processCheckout() {
    if (this.cartItems.length === 0) return;

    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Procesando pedidos...',
      spinner: 'crescent'
    });
    await loading.present();

    // 1. Agrupar los items del carrito por seller_id (Vendedor)
    const groupedItems: { [key: string]: CartItem[] } = {};
    this.cartItems.forEach(item => {
      const sellerId = item.product.seller_id;
      if (!groupedItems[sellerId]) {
        groupedItems[sellerId] = [];
      }
      groupedItems[sellerId].push(item);
    });

    // 2. Crear un pedido por cada vendedor en paralelo
    const orderRequests = Object.keys(groupedItems).map(sellerId => {
      const sellerItems = groupedItems[sellerId].map(item => ({
        product_id: item.product.id,
        quantity: item.quantity
      }));
      return this.orderRepository.createOrder(sellerId, this.selectedSpot, sellerItems);
    });

    forkJoin(orderRequests).subscribe({
      next: (orderIds) => {
        loading.dismiss();
        this.cartService.clearCart();
        this.showSuccessAlert(orderIds.length);
      },
      error: async (err) => {
        loading.dismiss();
        const alert = await this.alertCtrl.create({
          header: 'Fallo al procesar pedido',
          message: err.message || 'Ocurrió un error en el stock o en el proceso de reserva. Inténtalo de nuevo.',
          buttons: ['Entendido'],
          cssClass: 'custom-alert'
        });
        await alert.present();
      }
    });
  }

  async showSuccessAlert(ordersCount: number) {
    const alert = await this.alertCtrl.create({
      header: '¡Pedido Realizado!',
      message: ordersCount === 1
        ? 'Tu pedido ha sido enviado al emprendedor. Revisa la sección de pedidos para contactarlo por WhatsApp.'
        : `Se han generado ${ordersCount} pedidos individuales para cada emprendedor. Por favor coordina con cada uno.`,
      buttons: [
        {
          text: 'Ver mis Pedidos',
          handler: () => {
            this.router.navigate(['/orders']);
          }
        }
      ],
      cssClass: 'custom-alert'
    });
    await alert.present();
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 1500,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  goToCatalog() {
    this.router.navigate(['/catalog']);
  }

  goToOrders() {
    this.router.navigate(['/orders']);
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }

  signOut() {
    this.authService.signOut().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }
}
