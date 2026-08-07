import { Component, OnInit, OnDestroy, inject, Inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ORDER_REPOSITORY, OrderRepository } from '../../../../core/repositories/order.repository';
import { Order, OrderStatus } from '../../../../core/models/order.model';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-buyer-order-tracking',
  templateUrl: './buyer-order-tracking.component.html',
  styleUrls: ['./buyer-order-tracking.component.scss'],
  standalone: false
})
export class BuyerOrderTrackingComponent implements OnInit, OnDestroy {
  orderId = '';
  order: Order | null = null;
  loading = true;
  
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private subs = new Subscription();
  private pollingSub?: Subscription;

  constructor(
    @Inject(ORDER_REPOSITORY) private orderRepository: OrderRepository
  ) {}

  ngOnInit() {
    this.orderId = this.route.snapshot.paramMap.get('id') || '';
    if (this.orderId) {
      this.loadOrder();
      
      // Poll every 5 seconds for status updates
      this.pollingSub = interval(5000).subscribe(() => {
        this.loadOrder(true);
      });
    } else {
      this.router.navigate(['/buyer-panel/orders']);
    }
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
    }
  }

  loadOrder(silent = false) {
    if (!silent) this.loading = true;
    
    this.subs.add(
      this.orderRepository.getOrderById(this.orderId).subscribe({
        next: (order) => {
          this.order = order;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error fetching order', err);
          if (!silent) {
            this.loading = false;
            this.router.navigate(['/buyer-panel/orders']);
          }
        }
      })
    );
  }

  goBack() {
    this.router.navigate(['/buyer-panel/orders']);
  }

  getProductName(): string {
    if (!this.order || !this.order.order_items?.length) return 'Producto';
    const firstItem = this.order.order_items[0];
    const qty = firstItem.quantity > 1 ? ` x${firstItem.quantity}` : '';
    return `${firstItem.product?.name}${qty}`;
  }

  getProductImage(): string {
    if (!this.order || !this.order.order_items?.length) return 'assets/images/placeholder-food.png';
    return this.order.order_items[0].product?.product_images?.[0]?.image_url || 'assets/images/placeholder-food.png';
  }
  
  getOrderTotal(): number {
    return this.order?.total_price || 0;
  }

  getSellerName(): string {
    return this.order?.seller?.full_name || 'Emprendedor';
  }
  
  getLocation(): string {
    return this.order?.delivery_place || 'Pabellón A';
  }

  get shortOrderId(): string {
    if (!this.orderId) return '';
    return this.orderId.substring(0, 4).toUpperCase();
  }

  get currentStatusIndex(): number {
    if (!this.order) return 0;
    const statuses: OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready', 'completed'];
    const idx = statuses.indexOf(this.order.status);
    return idx === -1 ? 0 : idx;
  }
  
  isCancelled(): boolean {
    return this.order?.status === 'cancelled';
  }
  
  getEstimatedTime(): string {
    const status = this.order?.status;
    if (status === 'pending') return '~15 minutos';
    if (status === 'accepted') return '~10 minutos';
    if (status === 'preparing') return '~5 minutos';
    if (status === 'ready') return '¡Ahora!';
    return '-';
  }
}
