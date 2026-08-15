import { Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService, AppNotification } from '../../../../core/services/notification.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-admin-notifications',
  templateUrl: './admin-notifications.component.html',
  styleUrls: ['./admin-notifications.component.scss'],
  standalone: false
})
export class AdminNotificationsComponent {
  @Input() direction: 'down' | 'up' = 'down';

  private notificationService = inject(NotificationService);
  private router = inject(Router);

  notifications$: Observable<AppNotification[]> = this.notificationService.notifications$;
  unreadCount$: Observable<number> = this.notificationService.unreadCount$;
  showDropdown = false;

  toggle() {
    this.showDropdown = !this.showDropdown;
  }

  markAllRead() {
    this.notificationService.markAllAsRead();
  }

  onNotificationClick(notif: AppNotification) {
    this.showDropdown = false;
    this.router.navigate([notif.report_id ? '/admin/reports' : '/admin/dashboard']);
  }
}
