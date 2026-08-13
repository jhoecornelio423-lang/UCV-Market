import { Component, inject } from '@angular/core';
import { NotificationService, AppNotification } from '../../../../core/services/notification.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-buyer-notifications',
  templateUrl: './buyer-notifications.component.html',
  styleUrls: ['./buyer-notifications.component.scss'],
  standalone: false
})
export class BuyerNotificationsComponent {
  private notificationService = inject(NotificationService);
  notifications$: Observable<AppNotification[]> = this.notificationService.notifications$;

  markAllAsRead() {
    this.notificationService.markAllAsRead();
  }
}
