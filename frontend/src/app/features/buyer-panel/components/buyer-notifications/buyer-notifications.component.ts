import { Component, OnInit } from '@angular/core';
import { NotificationService, AppNotification } from '../../../../core/services/notification.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-buyer-notifications',
  templateUrl: './buyer-notifications.component.html',
  styleUrls: ['./buyer-notifications.component.scss'],
  standalone: false
})
export class BuyerNotificationsComponent implements OnInit {
  notifications$: Observable<AppNotification[]>;

  constructor(private notificationService: NotificationService) {
    this.notifications$ = this.notificationService.notifications$;
  }

  ngOnInit() {}

  markAllAsRead() {
    this.notificationService.markAllAsRead();
  }
}
