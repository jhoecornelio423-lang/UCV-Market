import { Component, OnInit, OnDestroy, inject, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, AlertController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';

import { ORDER_REPOSITORY, OrderRepository } from '../../../../core/repositories/order.repository';
import { AuthService } from '../../../../core/auth/auth.service';
import { Order, OrderStatus } from '../../../../core/models/order.model';
import { Profile } from '../../../../core/models/profile.model';

@Component({
  selector: 'app-buyer-orders',
  templateUrl: './buyer-orders.component.html',
  styleUrls: ['./buyer-orders.component.scss'],
  standalone: false
})
export class BuyerOrdersComponent implements OnInit, OnDestroy {
  buyerOrders: Order[] = [];
  activeTab: 'compras' | 'ventas' = 'compras'; // Mantener campo para compatibilidad con la firma del componente
  buyerFilter: 'active' | 'history' = 'active';
  userProfile: Profile | null = null;
  loading = false;

  get visibleOrders(): Order[] {
    const historicalStatuses: OrderStatus[] = ['completed', 'cancelled'];
    return this.buyerOrders.filter(order => this.buyerFilter === 'history'
      ? historicalStatuses.includes(order.status)
      : !historicalStatuses.includes(order.status));
  }

  private subscriptions = new Subscription();

  private authService = inject(AuthService);
  public router = inject(Router);
  private loadingCtrl = inject(LoadingController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private orderRepository = inject(ORDER_REPOSITORY);

  ngOnInit() {
    this.subscriptions.add(
      this.authService.currentProfile$.subscribe(profile => {
        this.userProfile = profile;
        if (profile) {
          this.loadBuyerOrders(profile.id);
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadBuyerOrders(buyerId: string) {
    this.loading = true;
    this.orderRepository.getBuyerOrders(buyerId).subscribe({
      next: (orders) => {
        this.buyerOrders = orders;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar compras:', err);
        this.loading = false;
      }
    });
  }

  refreshOrders(event: any) {
    if (this.userProfile) {
      this.loadBuyerOrders(this.userProfile.id);
    }
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }

  setBuyerFilter(filter: 'active' | 'history') {
    this.buyerFilter = filter;
  }

  getStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      pending: 'Pendiente',
      accepted: 'Aceptado',
      preparing: 'Preparando',
      ready: 'Listo',
      completed: 'Entregado',
      cancelled: 'Cancelado'
    };

    return labels[status];
  }

  getPartnerName(order: Order): string {
    return order.seller?.full_name || 'Emprendedor UCV';
  }

  getOrderDateLabel(createdAt?: string): string {
    if (!createdAt) return '';

    const orderDate = new Date(createdAt);
    if (Number.isNaN(orderDate.getTime())) return '';

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfOrderDate = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
    const differenceInDays = Math.round((startOfToday.getTime() - startOfOrderDate.getTime()) / 86400000);

    let dayLabel: string;
    if (differenceInDays === 0) {
      dayLabel = 'Hoy';
    } else if (differenceInDays === 1) {
      dayLabel = 'Ayer';
    } else {
      dayLabel = orderDate.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
    }

    const timeLabel = orderDate
      .toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit', hour12: true })
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')
      .toLowerCase();

    return `${dayLabel}, ${timeLabel}`;
  }

  /**
   * Permite al comprador cancelar un pedido únicamente si está en estado 'pending'.
   */
  async cancelOrder(order: Order) {
    const confirmAlert = await this.alertCtrl.create({
      header: 'Cancelar Pedido',
      message: '¿Estás seguro de que deseas cancelar este pedido? El stock del producto se restablecerá automáticamente.',
      buttons: [
        {
          text: 'No, mantener',
          role: 'cancel'
        },
        {
          text: 'Sí, cancelar',
          handler: () => {
            this.executeStatusUpdate(order.id, 'cancelled');
          }
        }
      ],
      cssClass: 'custom-alert'
    });
    await confirmAlert.present();
  }

  /**
   * Permite al emprendedor cambiar el estado del pedido.
   */
  private async executeStatusUpdate(orderId: string, status: OrderStatus) {
    const loading = await this.loadingCtrl.create({
      message: 'Actualizando pedido...',
      spinner: 'crescent'
    });
    await loading.present();

    this.orderRepository.updateOrderStatus(orderId, status).subscribe({
      next: () => {
        loading.dismiss();
        this.showToast('Pedido actualizado con éxito.', 'success');
        if (this.userProfile) {
          this.loadBuyerOrders(this.userProfile.id);
        }
      },
      error: async (err) => {
        loading.dismiss();
        const alert = await this.alertCtrl.create({
          header: 'Error al actualizar',
          message: err.message || 'No se pudo cambiar el estado del pedido.',
          buttons: ['Entendido'],
          cssClass: 'custom-alert'
        });
        await alert.present();
      }
    });
  }

  /**
   * Califica al emprendedor tras una compra exitosa.
   */
  async qualifySeller(order: Order) {
    const alert = await this.alertCtrl.create({
      header: 'Calificar Emprendedor',
      subHeader: `Pedido #${order.id.substring(0, 8)}`,
      message: 'Evalúa tu experiencia de compra del 1 al 5:',
      inputs: [
        {
          name: 'rating',
          type: 'number',
          placeholder: 'Estrellas (1-5)',
          min: 1,
          max: 5
        },
        {
          name: 'comment',
          type: 'textarea',
          placeholder: 'Deja tu comentario/reseña aquí...'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Enviar Calificación',
          handler: (data) => {
            const rating = parseInt(data.rating, 10);
            const comment = data.comment;

            if (isNaN(rating) || rating < 1 || rating > 5) {
              this.showToast('Por favor, ingresa una calificación válida del 1 al 5.', 'warning');
              return false; // Evita cerrar el modal
            }

            this.submitReview(order, rating, comment);
            return true;
          }
        }
      ],
      cssClass: 'custom-alert'
    });
    await alert.present();
  }

  private submitReview(order: Order, rating: number, comment: string) {
    if (!this.userProfile) return;

    this.orderRepository.addReview(
      order.id,
      rating,
      comment,
      this.userProfile.id, // Reviewer: comprador
      order.seller_id       // Reviewee: vendedor
    ).subscribe({
      next: () => {
        this.showToast('¡Muchas gracias por tu calificación!', 'success');
        if (this.userProfile) {
          this.loadBuyerOrders(this.userProfile.id);
        }
      },
      error: (err) => {
        console.error('Error al calificar:', err);
        this.showToast('No se pudo enviar la calificación.', 'danger');
      }
    });
  }

  /**
   * Abre WhatsApp para coordinar la entrega física del pedido.
   */
  contactPartnerViaWhatsApp(order: Order, type: 'compras' | 'ventas') {
    const partnerPhone = type === 'compras' ? order.seller?.phone : order.buyer?.phone;
    const partnerName = type === 'compras' ? order.seller?.full_name : order.buyer?.full_name;

    if (!partnerPhone) {
      this.showToast('Teléfono de contacto no disponible.', 'warning');
      return;
    }

    const orderHash = order.id.substring(0, 8);
    const message = type === 'compras'
      ? `Hola ${partnerName}, te escribo por el pedido *#${orderHash}* de VALLE-GO.\n\nElegí el punto *${order.delivery_place}*. ¿Me confirmas cuándo nos reunimos?`
      : `Hola ${partnerName}, soy el emprendedor de VALLE-GO. Te escribo por tu pedido *#${orderHash}*.\n\nEstaré en *${order.delivery_place}* para entregarte tu pedido.`;

    const waUrl = `https://wa.me/51${partnerPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  goToCatalog() {
    this.router.navigate(['/buyer-panel/catalog']);
  }

  goToSellerDashboard() {
    this.router.navigate(['/seller']);
  }

  goToProfile() {
    this.router.navigate(['/buyer-panel/profile']);
  }

  goToTracking(order: Order) {
    this.router.navigate(['/buyer-panel/tracking', order.id]);
  }

  signOut() {
    this.authService.signOut().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }
}
