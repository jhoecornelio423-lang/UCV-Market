import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-buyer-order-confirmed',
  templateUrl: './buyer-order-confirmed.component.html',
  styleUrls: ['./buyer-order-confirmed.component.scss'],
  standalone: false
})
export class BuyerOrderConfirmedComponent {
  orderNumber = '';
  location = '';
  time = '';
  private router = inject(Router);
  orderId = '';

  constructor() {
    const navigation = this.router.getCurrentNavigation();
    let orderId = '';
    let location = '';
    let time = '';

    if (navigation?.extras.state) {
      orderId = navigation.extras.state['orderId'] || '';
      location = navigation.extras.state['location'] || '';
      time = navigation.extras.state['time'] || '';
    }

    // Si se recargó la página, recuperamos los datos del último pedido registrado
    if (!orderId) {
      try {
        const stored = sessionStorage.getItem('ucv_last_order');
        if (stored) {
          const lastOrder = JSON.parse(stored);
          orderId = lastOrder.orderId || '';
          location = lastOrder.location || '';
          time = lastOrder.time || '';
        }
      } catch (e) {
        // Datos de sesión inválidos; se ignora
      }
    }

    this.orderId = orderId;
    this.location = location;
    this.time = time;
    this.orderNumber = orderId ? `#UCM-${orderId.substring(0, 4).toUpperCase()}` : '';
  }

  trackOrder() {
    if (this.orderId) {
      this.router.navigate(['/buyer-panel/tracking', this.orderId]);
    } else {
      this.router.navigate(['/buyer-panel/orders']);
    }
  }

  goHome() {
    this.router.navigate(['/buyer-panel/catalog']);
  }
}
