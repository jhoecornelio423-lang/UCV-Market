import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-buyer-order-confirmed',
  templateUrl: './buyer-order-confirmed.component.html',
  styleUrls: ['./buyer-order-confirmed.component.scss'],
  standalone: false
})
export class BuyerOrderConfirmedComponent implements OnInit {
  orderNumber = '';
  location = '';
  time = '';
  private router = inject(Router);
  orderId = '';

  constructor() {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.location = navigation.extras.state['location'] || 'Pabellón A';
      this.time = navigation.extras.state['time'] || '12:00 pm';
      this.orderId = navigation.extras.state['orderId'] || '';
    } else {
      this.location = 'Pabellón A';
      this.time = '12:00 pm';
    }
    
    // Generate a mock order number if no orderId
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    this.orderNumber = this.orderId ? `#UCM-${this.orderId.substring(0, 4).toUpperCase()}` : `#UCM-${randomNum}`;
  }

  ngOnInit() {}

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
