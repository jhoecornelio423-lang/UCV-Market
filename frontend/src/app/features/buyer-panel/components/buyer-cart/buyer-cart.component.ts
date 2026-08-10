import { Component, OnInit, OnDestroy, inject, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, AlertController, ToastController } from '@ionic/angular';
import { Subscription, forkJoin, from } from 'rxjs';

import { CartService, CartItem } from '../../../../core/cart/cart.service';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-buyer-cart',
  templateUrl: './buyer-cart.component.html',
  styleUrls: ['./buyer-cart.component.scss'],
  standalone: false
})
export class BuyerCartComponent implements OnInit, OnDestroy {
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

  constructor() {}

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

  goToCheckout() {
    if (this.cartItems.length === 0) return;
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    this.router.navigate(['/buyer-panel/checkout']);
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

  goToExplore() {
    this.router.navigate(['/buyer-panel/explore']);
  }

  goToOrders() {
    this.router.navigate(['/buyer-panel/orders']);
  }

  goToProfile() {
    this.router.navigate(['/buyer-panel/profile']);
  }

  signOut() {
    this.authService.signOut().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }
}
