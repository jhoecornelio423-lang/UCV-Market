import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { SellerStateService } from '../../services/seller-state.service';
import { ToastController } from '@ionic/angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { SupabaseClientService } from '../../../../core/database/supabase.client';
import { NotificationService, AppNotification } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-seller-dashboard',
  templateUrl: './seller-dashboard.component.html',
  styleUrls: ['./seller-dashboard.component.scss'],
  standalone: false
})
export class SellerDashboardComponent {
  private sellerState = inject(SellerStateService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private authService = inject(AuthService);
  private supabaseService = inject(SupabaseClientService);
  private notificationService = inject(NotificationService);

  stats$ = this.sellerState.stats$;
  userProfile$ = this.sellerState.userProfile$;
  activeOrders$ = this.sellerState.activeOrders$;
  notifications$: Observable<AppNotification[]> = this.notificationService.notifications$;
  unreadCount$: Observable<number> = this.notificationService.unreadCount$;
  
  showNotifDropdown = false;
  isReviewsModalOpen = false;
  reviews: any[] = [];
  loadingReviews = false;

  openReviewsModal() {
    const profile = this.sellerState.currentUserProfile;
    if (!profile) return;
    
    this.isReviewsModalOpen = true;
    this.loadingReviews = true;
    
    this.supabaseService.client
      .from('reviews')
      .select(`
        id,
        rating,
        comment,
        created_at,
        reviewer:profiles!reviewer_id(
          full_name,
          avatar_url
        )
      `)
      .eq('reviewee_id', profile.id)
      .order('created_at', { ascending: false })
      .then(
        (response: any) => {
          if (response.error) {
            console.error('Error fetching reviews:', response.error.message);
          } else {
            this.reviews = response.data || [];
          }
          this.loadingReviews = false;
        },
        (err: any) => {
          console.error('Error al cargar reseñas:', err);
          this.loadingReviews = false;
        }
      );
  }

  showNotifications() {
    this.showNotifDropdown = !this.showNotifDropdown;
  }

  markAllRead() {
    this.notificationService.markAllAsRead();
  }

  onNotificationClick(notif: any) {
    if (notif.unread) {
      this.notificationService.markAllAsRead();
    }

    this.showNotifDropdown = false;

    if (notif.order_id) {
      this.router.navigate(['/seller/orders']);
    } else {
      this.router.navigate(['/seller/orders']);
    }
  }

  getReputationLabel(rating: number): string {
    if (rating >= 4.5) return 'Excelente';
    if (rating >= 4.0) return 'Buena';
    return 'Regular';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      accepted: 'Aceptado',
      preparing: 'Preparando',
      ready: 'Listo',
      completed: 'Entregado',
      cancelled: 'Cancelado'
    };
    return labels[status] || status;
  }

  getMaxSales(): number {
    const stats = this.sellerState['statsSubject'].value;
    if (!stats.salesData) return 10;
    const max = Math.max(...stats.salesData.map((d: any) => d.ventas));
    return max > 0 ? max : 10;
  }

  get svgLinePath(): string {
    const stats = this.sellerState['statsSubject'].value;
    if (!stats.salesData) return '';
    const max = this.getMaxSales();
    const points = stats.salesData.map((d: any, i: number) => {
      const x = 50 + i * 100;
      const y = 140 - (d.ventas / max) * 110;
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  }

  get svgAreaPath(): string {
    const stats = this.sellerState['statsSubject'].value;
    if (!stats.salesData) return '';
    const max = this.getMaxSales();
    const points = stats.salesData.map((d: any, i: number) => {
      const x = 50 + i * 100;
      const y = 140 - (d.ventas / max) * 110;
      return `${x},${y}`;
    });
    if (points.length === 0) return '';
    return `M 50,140 L ${points.join(' L ')} L 650,140 Z`;
  }

  getChartPointX(index: number): number {
    return 50 + index * 100;
  }

  getChartPointY(val: number): number {
    const max = this.getMaxSales();
    return 140 - (val / max) * 110;
  }

  async onChartBarClick(data: any) {
    const toast = await this.toastCtrl.create({
      message: `Ventas del ${data.day}: ${data.ventas} pedidos realizados.`,
      duration: 2000,
      color: 'primary',
      position: 'bottom'
    });
    await toast.present();
  }

  goToProducts() {
    this.router.navigate(['/seller/products']);
  }

  goToOrders() {
    this.router.navigate(['/seller/orders']);
  }

  signOut() {
    this.authService.signOut().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (err) => {
        console.error('Error al cerrar sesión:', err);
      }
    });
  }
}
