import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { NotificationService, AppNotification } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-seller-notifications',
  templateUrl: './seller-notifications.component.html',
  styleUrls: ['./seller-notifications.component.scss'],
  standalone: false
})
export class SellerNotificationsComponent {
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  notifications$: Observable<AppNotification[]> = this.notificationService.notifications$;

  markAllAsRead() {
    this.notificationService.markAllAsRead();
  }

  onNotificationClick(notif: AppNotification) {
    this.notificationService.markAllAsRead();
    if (notif.ticket_id) {
      this.router.navigate(['/seller/support']);
    } else {
      this.router.navigate(['/seller/orders']);
    }
  }
}
