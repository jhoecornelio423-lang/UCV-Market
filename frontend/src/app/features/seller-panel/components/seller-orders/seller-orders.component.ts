import { Component, inject, OnInit } from '@angular/core';
import { Observable, map } from 'rxjs';
import { SellerStateService } from '../../services/seller-state.service';
import { ORDER_REPOSITORY } from '../../../../core/repositories/order.repository';
import { Order, OrderStatus } from '../../../../core/models/order.model';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-seller-orders',
  templateUrl: './seller-orders.component.html',
  styleUrls: ['./seller-orders.component.scss'],
  standalone: false
})
export class SellerOrdersComponent implements OnInit {
  private sellerState = inject(SellerStateService);
  private orderRepository = inject(ORDER_REPOSITORY);
  private toastCtrl = inject(ToastController);

  currentTab: 'nuevos' | 'activos' | 'listos' = 'nuevos';

  allOrders$: Observable<Order[]> = this.sellerState.allOrders$;

  nuevosOrders$: Observable<Order[]> = this.allOrders$.pipe(
    map(orders => orders.filter(o => o.status === 'pending').sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()))
  );

  activosOrders$: Observable<Order[]> = this.allOrders$.pipe(
    map(orders => orders.filter(o => o.status === 'accepted' || o.status === 'preparing').sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()))
  );

  listosOrders$: Observable<Order[]> = this.allOrders$.pipe(
    map(orders => orders.filter(o => o.status === 'ready').sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()))
  );

  ngOnInit() {
    this.sellerState.refreshData(); // Ensure fresh data when entering the view
  }

  setTab(tab: 'nuevos' | 'activos' | 'listos') {
    this.currentTab = tab;
  }

  async updateStatus(order: Order, newStatus: OrderStatus) {
    // Optimistic UI updates could be done, but reloading from state is safer
    this.orderRepository.updateOrderStatus(order.id, newStatus).subscribe({
      next: async () => {
        this.sellerState.refreshData();
        const toast = await this.toastCtrl.create({
          message: `Pedido actualizado correctamente.`,
          duration: 2000,
          color: 'success',
          position: 'top'
        });
        await toast.present();
      },
      error: async (err) => {
        const toast = await this.toastCtrl.create({
          message: 'Error al actualizar el pedido.',
          duration: 2000,
          color: 'danger',
          position: 'top'
        });
        await toast.present();
      }
    });
  }

  acceptOrder(order: Order) {
    this.updateStatus(order, 'accepted');
  }

  rejectOrder(order: Order) {
    this.updateStatus(order, 'cancelled');
  }

  markPreparing(order: Order) {
    this.updateStatus(order, 'preparing');
  }

  markReady(order: Order) {
    this.updateStatus(order, 'ready');
  }

  markCompleted(order: Order) {
    this.updateStatus(order, 'completed');
  }
}
