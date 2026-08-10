import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseClientService } from '../database/supabase.client';
import { AuthService } from '../auth/auth.service';

export interface AppNotification {
  id: string;
  order_id?: string;
  title: string;
  body: string;
  time: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  unread: boolean;
  type: string;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<AppNotification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();
  
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  private storageKey = 'ucv_market_buyer_notifications';
  private currentUserId: string | null = null;
  private channel: any;

  constructor(
    private supabaseService: SupabaseClientService,
    private authService: AuthService
  ) {
    this.authService.currentProfile$.subscribe(user => {
      if (user) {
        this.currentUserId = user.id;
        this.storageKey = `ucv_market_buyer_notifs_${user.id}`;
        this.loadFromStorage();
        this.setupRealtimeSubscription();
      } else {
        this.currentUserId = null;
        this.notificationsSubject.next([]);
        this.updateUnreadCount();
        if (this.channel) {
          this.supabaseService.client.removeChannel(this.channel);
          this.channel = null;
        }
      }
    });
  }

  private loadFromStorage() {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      try {
        const notifs = JSON.parse(stored) as AppNotification[];
        // Sort by newest first
        notifs.sort((a, b) => b.timestamp - a.timestamp);
        this.notificationsSubject.next(notifs);
        this.updateUnreadCount();
      } catch (e) {
        console.error('Error loading notifications', e);
      }
    }
  }

  private saveToStorage(notifs: AppNotification[]) {
    localStorage.setItem(this.storageKey, JSON.stringify(notifs));
    this.notificationsSubject.next(notifs);
    this.updateUnreadCount();
  }

  private updateUnreadCount() {
    const count = this.notificationsSubject.value.filter(n => n.unread).length;
    this.unreadCountSubject.next(count);
  }

  public markAllAsRead() {
    const notifs = this.notificationsSubject.value;
    notifs.forEach(n => n.unread = false);
    this.saveToStorage(notifs);
  }

  private setupRealtimeSubscription() {
    if (!this.currentUserId) return;

    if (this.channel) {
      this.supabaseService.client.removeChannel(this.channel);
    }

    this.channel = this.supabaseService.client
      .channel('buyer-order-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `buyer_id=eq.${this.currentUserId}`
        },
        (payload: any) => {
          this.handleOrderStatusChange(payload.old, payload.new);
        }
      )
      .subscribe();
  }

  private handleOrderStatusChange(oldOrder: any, newOrder: any) {
    // Solo si el estado cambia realmente
    if (oldOrder.status === newOrder.status) return;

    let title = '';
    let body = '';
    let icon = 'cube-outline';
    let iconBg = '#F3F4F6';
    let iconColor = '#818a9b';

    switch (newOrder.status) {
      case 'accepted':
        title = 'Pedido aceptado';
        body = `Tu pedido ha sido aceptado por el vendedor y está en cola.`;
        icon = 'checkmark-circle';
        iconBg = '#ECFDF5';
        iconColor = '#10B981';
        break;
      case 'preparing':
        title = 'Preparándose';
        body = `Tu pedido ya se está preparando. ¡Casi listo!`;
        icon = 'restaurant';
        iconBg = '#FFFBEB';
        iconColor = '#F59E0B';
        break;
      case 'ready':
        title = 'Tu pedido está listo';
        body = `¡El vendedor ha terminado tu pedido! Ya puedes recogerlo.`;
        icon = 'gift';
        iconBg = '#FFF2F0';
        iconColor = '#E8432D';
        break;
      case 'completed':
        title = 'Pedido completado';
        body = `¡Gracias por tu compra! Esperamos que lo disfrutes.`;
        icon = 'star';
        iconBg = '#FFF2F0';
        iconColor = '#E8432D';
        break;
      case 'cancelled':
        title = 'Pedido cancelado';
        body = `Tu pedido fue cancelado. Comunícate con el vendedor si tienes dudas.`;
        icon = 'close-circle';
        iconBg = '#FEF2F2';
        iconColor = '#EF4444';
        break;
      default:
        return; // Ignore other statuses
    }

    const newNotif: AppNotification = {
      id: Math.random().toString(36).substr(2, 9),
      order_id: newOrder.id,
      title,
      body,
      time: 'Justo ahora',
      icon,
      iconBg,
      iconColor,
      unread: true,
      type: 'order',
      timestamp: Date.now()
    };

    const currentNotifs = this.notificationsSubject.value;
    // Add to top of list
    const updatedNotifs = [newNotif, ...currentNotifs].slice(0, 50); // Keep max 50
    this.saveToStorage(updatedNotifs);
  }

  // Permite simular una notificación para pruebas
  public testNotification(status: 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled') {
    this.handleOrderStatusChange({ status: 'pending' }, { id: 'test-order', status });
  }
}
