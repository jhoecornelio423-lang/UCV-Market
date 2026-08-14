import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications, Token } from '@capacitor/push-notifications';
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
  private currentRole: string | null = null;
  private channels: any[] = [];
  private pushListenerHandles: any[] = [];

  private permissionsRequested = false;
  private channelReady = false;

  private static readonly CHANNEL_ID = 'pedidos';

  private supabaseService = inject(SupabaseClientService);
  private authService = inject(AuthService);
  private router = inject(Router);

  constructor() {
    this.authService.currentProfile$.subscribe(user => {
      if (user) {
        this.currentUserId = user.id;
        this.currentRole = user.role;
        this.storageKey = `ucv_market_buyer_notifs_${user.id}`;
        this.loadFromStorage();
        this.setupRealtimeSubscriptions();
        this.setupPushNotifications();
      } else {
        this.currentUserId = null;
        this.currentRole = null;
        this.notificationsSubject.next([]);
        this.updateUnreadCount();
        this.removeChannels();
        this.removePushListeners();
      }
    });
  }

  private removeChannels() {
    this.channels.forEach(ch => {
      try {
        this.supabaseService.client.removeChannel(ch);
      } catch (e) {
        console.error('Error al remover canal realtime', e);
      }
    });
    this.channels = [];
  }

  /**
   * Push notifications (FCM): registra el dispositivo y guarda el token en Supabase.
   * La notificación la muestra el propio sistema, incluso con la app cerrada.
   */
  private async setupPushNotifications() {
    if (!Capacitor.isNativePlatform() || !this.currentUserId) return;
    try {
      const perm = await PushNotifications.checkPermissions();
      if (perm.receive !== 'granted') {
        const req = await PushNotifications.requestPermissions();
        if (req.receive !== 'granted') return;
      }

      this.pushListenerHandles.push(
        await PushNotifications.addListener('registration', (token: Token) => {
          this.savePushToken(token.value);
        })
      );
      this.pushListenerHandles.push(
        await PushNotifications.addListener('registrationError', (err: any) => {
          console.error('Error registrando FCM:', err);
        })
      );
      this.pushListenerHandles.push(
        await PushNotifications.addListener('pushNotificationActionPerformed', (action: any) => {
          this.handlePushTap(action);
        })
      );

      await PushNotifications.register();
    } catch (e) {
      console.error('Error configurando push notifications:', e);
    }
  }

  private async savePushToken(token: string) {
    if (!this.currentUserId) return;
    try {
      await this.supabaseService.client
        .from('push_tokens')
        .upsert(
          { user_id: this.currentUserId, token, platform: Capacitor.getPlatform() },
          { onConflict: 'token' }
        );
    } catch (e) {
      console.error('Error guardando token push:', e);
    }
  }

  private handlePushTap(action: any) {
    const notif = action?.notification || action;
    const orderId = notif?.data?.order_id;
    const target = this.currentRole === 'emprendedor' ? '/seller/orders' : '/buyer/orders';
    this.router.navigate([target], orderId ? { queryParams: { order: orderId } } : {});
  }

  private removePushListeners() {
    this.pushListenerHandles.forEach(handle => {
      try {
        handle.remove();
      } catch (e) {
        console.error('Error removiendo listener push', e);
      }
    });
    this.pushListenerHandles = [];
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

  private setupRealtimeSubscriptions() {
    if (!this.currentUserId) return;
    this.removeChannels();

    const userId = this.currentUserId;

    // 1) Comprador: cambios de estado de sus pedidos
    const buyerChannel = this.supabaseService.client
      .channel('buyer-order-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `buyer_id=eq.${userId}`
        },
        (payload: any) => {
          this.handleOrderStatusChange(payload.old, payload.new);
        }
      )
      .subscribe();
    this.channels.push(buyerChannel);

    // 2) Vendedor: llegada de un pedido nuevo
    const sellerChannel = this.supabaseService.client
      .channel('seller-new-order')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `seller_id=eq.${userId}`
        },
        (payload: any) => {
          this.handleNewOrder(payload.new);
        }
      )
      .subscribe();
    this.channels.push(sellerChannel);

    // 3) Comprador: cambio de estado de sus reportes de producto
    const reportChannel = this.supabaseService.client
      .channel('buyer-report-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'product_reports',
          filter: `reporter_id=eq.${userId}`
        },
        (payload: any) => {
          this.handleReportStatusChange(payload.old, payload.new);
        }
      )
      .subscribe();
    this.channels.push(reportChannel);
  }

  private handleNewOrder(newOrder: any) {
    const newNotif: AppNotification = {
      id: Math.random().toString(36).substr(2, 9),
      order_id: newOrder.id,
      title: '¡Nuevo pedido recibido!',
      body: 'Un comprador acaba de realizar un pedido. Revisa la sección de pedidos para aceptarlo.',
      time: 'Justo ahora',
      icon: 'bag-handle',
      iconBg: '#FFF2F0',
      iconColor: '#E8432D',
      unread: true,
      type: 'order',
      timestamp: Date.now()
    };

    this.pushNotification(newNotif);
    this.fireLocalNotification('¡Nuevo pedido recibido!', 'Un comprador realizó un pedido en tu emprendimiento.');
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

    this.pushNotification(newNotif);
    this.fireLocalNotification(title, body);
  }

  private handleReportStatusChange(oldReport: any, newReport: any) {
    if (!oldReport || !newReport) return;
    if (oldReport.status === newReport.status) return;

    if (newReport.status === 'resolved') {
      const newNotif: AppNotification = {
        id: Math.random().toString(36).substr(2, 9),
        title: 'Reporte aceptado y en revisión',
        body: 'Tu reporte fue aceptado por los moderadores y está siendo revisado. Gracias por tu ayuda.',
        time: 'Justo ahora',
        icon: 'shield-checkmark',
        iconBg: '#ECFDF5',
        iconColor: '#10B981',
        unread: true,
        type: 'report',
        timestamp: Date.now()
      };
      this.pushNotification(newNotif);
      this.fireLocalNotification('Reporte aceptado', 'Tu reporte fue aceptado y está en revisión. ¡Gracias por tu ayuda!');
    } else if (newReport.status === 'rejected') {
      const newNotif: AppNotification = {
        id: Math.random().toString(36).substr(2, 9),
        title: 'Reporte rechazado',
        body: 'Tu reporte fue evaluado y rechazado por los moderadores. Si tienes dudas, escríbenos a soporte.',
        time: 'Justo ahora',
        icon: 'shield-close',
        iconBg: '#FEF2F2',
        iconColor: '#EF4444',
        unread: true,
        type: 'report',
        timestamp: Date.now()
      };
      this.pushNotification(newNotif);
      this.fireLocalNotification('Reporte rechazado', 'Tu reporte fue evaluado y rechazado por los moderadores.');
    }
  }

  private pushNotification(notif: AppNotification) {
    const currentNotifs = this.notificationsSubject.value;
    const updatedNotifs = [notif, ...currentNotifs].slice(0, 50); // Keep max 50
    this.saveToStorage(updatedNotifs);
  }

  /**
   * Solicita el permiso de notificaciones apenas se abre la app
   * (se muestra una sola vez en Android 13+). También deja listo el canal.
   */
  public async requestPermission(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        await this.ensureChannel();
        const perm = await LocalNotifications.requestPermissions();
        if (perm.display === 'granted') {
          this.permissionsRequested = true;
          return true;
        }
        return false;
      } else if (typeof window !== 'undefined' && 'Notification' in window) {
        const result = await Notification.requestPermission();
        return result === 'granted';
      }
      return true;
    } catch (e) {
      console.error('Error al solicitar permiso de notificaciones:', e);
      return false;
    }
  }

  /**
   * Crea el canal de notificaciones (requerido en Android 8+ para mostrar
   * notificaciones). Importancia ALTA (5) = banner heads-up + sonido del sistema
   * + vibración, como WhatsApp. Un channelId sin canal creado hace que Android
   * descarte la notificación silenciosamente.
   */
  private async ensureChannel() {
    if (this.channelReady || !Capacitor.isNativePlatform()) return;
    try {
      await LocalNotifications.createChannel({
        id: NotificationService.CHANNEL_ID,
        name: 'Pedidos',
        description: 'Notificaciones de nuevos pedidos y actualizaciones de estado',
        importance: 5,
        vibration: true,
        lights: true,
        lightColor: '#E8432D'
      });
    } catch (e) {
      console.error('Error creando canal de notificaciones:', e);
    }
    this.channelReady = true;
  }

  /**
   * Dispara una notificación del sistema (celular) cuando la app está activa.
   * En navegador usa la API Web Notifications si hay permiso.
   */
  private async fireLocalNotification(title: string, body: string) {
    try {
      if (Capacitor.isNativePlatform()) {
        if (!this.permissionsRequested) {
          this.permissionsRequested = true;
          const perm = await LocalNotifications.requestPermissions();
          if (perm.display !== 'granted') return;
        }
        await this.ensureChannel();
        await LocalNotifications.schedule({
          notifications: [{
            id: Date.now(),
            title,
            body,
            channelId: NotificationService.CHANNEL_ID
          }]
        });
      } else if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(title, { body });
        }
      }
    } catch (e) {
      // No romper el flujo si las notificaciones locales fallan
      console.error('Error al mostrar notificación local:', e);
    }
  }

  // Permite simular una notificación para pruebas
  public testNotification(status: 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled') {
    this.handleOrderStatusChange({ status: 'pending' }, { id: 'test-order', status });
  }
}
