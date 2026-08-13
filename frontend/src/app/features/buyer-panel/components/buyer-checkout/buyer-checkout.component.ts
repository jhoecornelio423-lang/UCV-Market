import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, AlertController, ToastController } from '@ionic/angular';
import { Subscription, forkJoin, firstValueFrom, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { CartService, CartItem } from '../../../../core/cart/cart.service';
import { ORDER_REPOSITORY } from '../../../../core/repositories/order.repository';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-buyer-checkout',
  templateUrl: './buyer-checkout.component.html',
  styleUrls: ['./buyer-checkout.component.scss'],
  standalone: false
})
export class BuyerCheckoutComponent implements OnInit, OnDestroy {
  cartItems: CartItem[] = [];
  cartTotal = 0;
  
  // Opciones de Entrega
  deliverySpots = [
    'Biblioteca Pabellón A (1er Piso)',
    'Cafetería Principal - Patio Central',
    'Auditorio Central - Entrada',
    'Lobby de Ingreso Pabellón B',
    'Zona de Áreas Verdes - Bancas Centrales',
    'Portón de Ingreso Principal'
  ];
  selectedSpotId = 'Biblioteca Pabellón A (1er Piso)';

  // Opciones de Hora
  pickupTimes = ['11:30', '12:00', '12:30', '13:00'];
  selectedTime = '12:00';

  // Opciones de Pago
  paymentMethods = [
    { id: 'yape', title: 'Yape', icon: 'assets/images/yape.png', color: '' },
    { id: 'plin', title: 'Plin', icon: 'assets/images/plin.png', color: '' },
    { id: 'cash', title: 'Efectivo', icon: 'cash-outline', color: '#3880ff' }
  ];
  selectedPayment = 'yape';

  private subscriptions = new Subscription();
  isSubmitting = false;
  private cartService = inject(CartService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private loadingCtrl = inject(LoadingController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private orderRepository = inject(ORDER_REPOSITORY);

  ngOnInit() {
    this.subscriptions.add(
      this.cartService.cartItems$.subscribe(items => {
        this.cartItems = items;
        if (items.length === 0) {
          this.router.navigate(['/buyer-panel/cart']);
        }
      })
    );

    this.subscriptions.add(
      this.cartService.getCartTotal$().subscribe(total => {
        this.cartTotal = total;
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  async confirmOrder() {
    if (this.isSubmitting || this.cartItems.length === 0) return;

    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.isSubmitting = true;

    const loading = await this.loadingCtrl.create({
      message: 'Procesando pedidos...',
      spinner: 'crescent'
    });
    await loading.present();

    // 1. Agrupar los items del carrito por seller_id
    const groupedItems: { [key: string]: CartItem[] } = {};
    this.cartItems.forEach(item => {
      const sellerId = item.product.seller_id;
      if (!groupedItems[sellerId]) {
        groupedItems[sellerId] = [];
      }
      groupedItems[sellerId].push(item);
    });

    // Validar si algún vendedor tiene los pedidos desactivados
    for (const sellerId of Object.keys(groupedItems)) {
      const firstItemOfSeller = groupedItems[sellerId][0];
      const sellerProfile = firstItemOfSeller.product.seller;
      if (sellerProfile && sellerProfile.accepting_orders === false) {
        this.isSubmitting = false;
        loading.dismiss();
        const alert = await this.alertCtrl.create({
          header: 'Pedidos desactivados',
          message: `El emprendimiento de ${sellerProfile.full_name} actualmente no está aceptando pedidos. Por favor, retira sus productos de tu carrito.`,
          buttons: ['Entendido'],
          cssClass: 'custom-alert'
        });
        await alert.present();
        return;
      }
    }

    // Construir string de delivery incluyendo hora y pago temporalmente
    const spotTitle = this.selectedSpotId;
    const paymentTitle = this.paymentMethods.find(p => p.id === this.selectedPayment)?.title;
    const fullDeliveryLocation = `${spotTitle} | Hora: ${this.selectedTime} | Pago: ${paymentTitle}`;

    // 2. Crear un pedido por cada vendedor en paralelo, capturando los resultados individuales
    const orderResults$ = forkJoin(
      Object.keys(groupedItems).map(sellerId => {
        const sellerItems = groupedItems[sellerId].map(item => ({
          product_id: item.product.id,
          quantity: item.quantity
        }));
        return this.orderRepository.createOrder(sellerId, fullDeliveryLocation, sellerItems).pipe(
          map(orderId => ({ ok: true as const, orderId })),
          catchError(error => of({ ok: false as const, error }))
        );
      })
    );

    orderResults$.subscribe({
      next: (results) => {
        const createdIds = results.filter(r => r.ok).map(r => r.orderId);
        const failures = results.filter(r => !r.ok);

        // 3. Si alguna orden falló, hacer rollback de las órdenes ya creadas
        if (failures.length > 0) {
          this.rollbackOrders(createdIds).finally(async () => {
            this.isSubmitting = false;
            loading.dismiss();
            const firstFailure = failures[0] as { error: Error };
            const alert = await this.alertCtrl.create({
              header: 'Fallo al procesar pedido',
              message: createdIds.length > 0
                ? `${firstFailure.error.message || 'Ocurrió un error en el stock o en el proceso de reserva.'} Las órdenes ya creadas fueron canceladas automáticamente.`
                : firstFailure.error.message || 'Ocurrió un error en el stock o en el proceso de reserva. Inténtalo de nuevo.',
              buttons: ['Entendido'],
              cssClass: 'custom-alert'
            });
            await alert.present();
          });
          return;
        }

        this.isSubmitting = false;
        loading.dismiss();
        this.cartService.clearCart();
        this.showSuccessAlert(createdIds);
      },
      error: async (err) => {
        this.isSubmitting = false;
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

  private async rollbackOrders(orderIds: string[]): Promise<void> {
    if (orderIds.length === 0) return;
    try {
      await Promise.all(
        orderIds.map(id => firstValueFrom(this.orderRepository.updateOrderStatus(id, 'cancelled')))
      );
    } catch (err) {
      console.error('Error al cancelar las órdenes creadas (rollback):', err);
    }
  }

  async showSuccessAlert(orderIds: string[]) {
    // Instead of an alert, we navigate to the order confirmed screen.
    // We pass state so the order confirmed screen can show info based on the checkout data
    const deliveryLocation = this.selectedSpotId;
    const deliveryTime = this.selectedTime;

    sessionStorage.setItem('ucv_last_order', JSON.stringify({
      orderId: orderIds[0],
      location: deliveryLocation,
      time: deliveryTime
    }));

    this.router.navigate(['/buyer-panel/order-confirmed'], {
      state: {
        location: deliveryLocation,
        time: deliveryTime,
        ordersCount: orderIds.length,
        orderId: orderIds[0] // Pass the first order for tracking
      }
    });
  }
}
