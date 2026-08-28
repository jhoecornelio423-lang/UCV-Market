import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification.service';
import { SellerNotificationsComponent } from './seller-notifications.component';

describe('SellerNotificationsComponent', () => {
  let fixture: ComponentFixture<SellerNotificationsComponent>;
  const notifications = new BehaviorSubject<any[]>([]);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SellerNotificationsComponent],
      providers: [
        { provide: NotificationService, useValue: { notifications$: notifications, markAllAsRead: jasmine.createSpy() } },
        { provide: Router, useValue: { navigate: jasmine.createSpy() } },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(SellerNotificationsComponent);
  });

  it('shows mark-all only when an unread notification exists', () => {
    notifications.next([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mark-all-btn')).toBeNull();
    notifications.next([{ id: '1', title: 'Pedido', body: '', time: '', unread: true, icon: 'bag' }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mark-all-btn')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('ion-back-button')?.getAttribute('aria-label')).toBe('Volver');
    expect(fixture.nativeElement.querySelector('button.notification-card')).not.toBeNull();
  });
});
