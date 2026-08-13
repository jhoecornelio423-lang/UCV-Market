import { Component, OnInit, OnDestroy, inject, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, AlertController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';

import { ORDER_REPOSITORY, OrderRepository } from '../../../../core/repositories/order.repository';
import { PRODUCT_REPOSITORY, ProductRepository } from '../../../../core/repositories/product.repository';
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

  isReviewModalOpen = false;
  selectedOrder: Order | null = null;
  selectedRating = 0;
  reviewComment = '';

  isReportModalOpen = false;
  reportingProduct: { id: string, name: string } | null = null;
  reportReason = '';
  selectedEvidenceFile: File | null = null;
  selectedEvidenceFileUrl: string | null = null;
  submittingReport = false;

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
  private productRepository = inject(PRODUCT_REPOSITORY);

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
  qualifySeller(order: Order) {
    this.selectedOrder = order;
    this.selectedRating = 0;
    this.reviewComment = '';
    this.isReviewModalOpen = true;
  }

  setRating(rating: number) {
    this.selectedRating = rating;
  }

  getRatingLabel(rating: number): string {
    switch (rating) {
      case 1: return 'Muy malo ★';
      case 2: return 'Malo ★★';
      case 3: return 'Regular ★★★';
      case 4: return 'Bueno ★★★★';
      case 5: return '¡Excelente! ★★★★★';
      default: return '';
    }
  }

  submitCustomReview() {
    if (!this.selectedOrder || this.selectedRating === 0) return;
    
    this.isReviewModalOpen = false;
    this.submitReview(this.selectedOrder, this.selectedRating, this.reviewComment);
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

  async reportOrderProduct(order: Order) {
    if (!order.order_items || order.order_items.length === 0) return;

    const items = order.order_items.filter(item => item.product_id);
    if (items.length === 0) return;

    if (items.length === 1) {
      this.openReportModal(items[0].product_id, items[0].product?.name || 'Producto');
    } else {
      const inputs = items.map((item, idx) => ({
        name: 'product_id',
        type: 'radio' as const,
        label: item.product?.name || `Producto ${idx + 1}`,
        value: item.product_id,
        checked: idx === 0
      }));

      const alert = await this.alertCtrl.create({
        header: 'Selecciona el Producto',
        message: '¿Cuál de los productos comprados deseas reportar?',
        inputs: inputs as any,
        buttons: [
          { text: 'Cancelar', role: 'cancel' },
          {
            text: 'Siguiente',
            handler: (selectedProductId) => {
              const selectedItem = items.find(i => i.product_id === selectedProductId);
              if (selectedItem) {
                this.openReportModal(selectedItem.product_id, selectedItem.product?.name || 'Producto');
              }
            }
          }
        ]
      });
      await alert.present();
    }
  }

  openReportModal(productId: string, productName: string) {
    this.reportingProduct = { id: productId, name: productName };
    this.reportReason = '';
    this.selectedEvidenceFile = null;
    this.selectedEvidenceFileUrl = null;
    this.isReportModalOpen = true;
  }

  onEvidenceFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      this.selectedEvidenceFile = file;
      this.selectedEvidenceFileUrl = URL.createObjectURL(file);
    }
  }

  removeEvidenceFile() {
    this.selectedEvidenceFile = null;
    this.selectedEvidenceFileUrl = null;
  }

  submitProductReport() {
    if (!this.reportingProduct || !this.reportReason.trim()) return;

    const profile = this.authService.currentProfileValue;
    if (!profile) {
      this.showToast('No se encontró la sesión activa.', 'danger');
      this.submittingReport = false;
      return;
    }

    this.submittingReport = true;
    const reason = this.reportReason.trim();
    const productId = this.reportingProduct!.id;

    if (this.selectedEvidenceFile) {
      this.productRepository.uploadEvidence(this.selectedEvidenceFile, profile.id).subscribe({
        next: (url) => {
          this.sendReportData(productId, profile.id, reason, url);
        },
        error: (err) => {
          console.error('Error al subir evidencia:', err);
          this.showToast('Error al subir la imagen de evidencia.', 'danger');
          this.submittingReport = false;
        }
      });
    } else {
      this.sendReportData(productId, profile.id, reason);
    }
  }

  private sendReportData(productId: string, reporterId: string, reason: string, evidenceUrl?: string) {
    this.productRepository.reportProduct(productId, reporterId, reason, evidenceUrl).subscribe({
      next: () => {
        this.showToast('Reporte enviado con éxito. Los moderadores lo revisarán.', 'success');
        this.isReportModalOpen = false;
        this.submittingReport = false;
        this.reportingProduct = null;
        this.reportReason = '';
        this.selectedEvidenceFile = null;
        this.selectedEvidenceFileUrl = null;
      },
      error: (err) => {
        console.error('Error al reportar:', err);
        this.showToast('Error al enviar el reporte.', 'danger');
        this.submittingReport = false;
      }
    });
  }
}
