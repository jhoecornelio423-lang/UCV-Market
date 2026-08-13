import { Injectable, inject, Inject } from '@angular/core';
import { BehaviorSubject, forkJoin, Observable, Subject, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { PRODUCT_REPOSITORY, ProductRepository } from '../../../core/repositories/product.repository';
import { ORDER_REPOSITORY, OrderRepository } from '../../../core/repositories/order.repository';
import { AuthService } from '../../../core/auth/auth.service';
import { SupabaseClientService } from '../../../core/database/supabase.client';
import { Product } from '../../../core/models/product.model';
import { Category } from '../../../core/models/category.model';
import { Profile } from '../../../core/models/profile.model';
import { Order } from '../../../core/models/order.model';

export interface SellerStats {
  totalSalesToday: number;
  totalSales: number;
  totalClicks: number;
  pendingOrdersCount: number;
  activeProductsCount: number;
  avgTicket: number;
  newCustomersCount: number;
  categoryStats: any[];
  salesData: any[];
  salesGrowthToday: number;
  salesGrowthWeekly: number;
  ordersGrowth: number;
  ticketGrowth: number;
  customerGrowth: number;
  incomeGrowth: number;
  topProducts: any[];
  notifications: any[];
  unreadNotifCount: number;
  rating: number;
  reviewsCount: number;
  todayOrdersCount: number;
  totalOrders: number;
}

@Injectable({
  providedIn: 'root'
})
export class SellerStateService {
  private productRepository = inject(PRODUCT_REPOSITORY);
  private orderRepository = inject(ORDER_REPOSITORY);
  private authService = inject(AuthService);
  private supabaseService = inject(SupabaseClientService);

  private productsSubject = new BehaviorSubject<Product[]>([]);
  public products$ = this.productsSubject.asObservable();

  private categoriesSubject = new BehaviorSubject<Category[]>([]);
  public categories$ = this.categoriesSubject.asObservable();

  private activeOrdersSubject = new BehaviorSubject<Order[]>([]);
  public activeOrders$ = this.activeOrdersSubject.asObservable();

  private allOrdersSubject = new BehaviorSubject<Order[]>([]);
  public allOrders$ = this.allOrdersSubject.asObservable();

  private statsSubject = new BehaviorSubject<Partial<SellerStats>>({});
  public stats$ = this.statsSubject.asObservable();

  private userProfileSubject = new BehaviorSubject<Profile | null>(null);
  public userProfile$ = this.userProfileSubject.asObservable();

  public loading$ = new BehaviorSubject<boolean>(false);

  private readNotificationIds = new Set<string>();
  private channel: any;
  private storageKey = 'ucv_market_seller_read_notifs';

  constructor() {
    this.loadCategories();
    this.authService.currentProfile$.subscribe((profile: Profile | null) => {
      this.userProfileSubject.next(profile);
      if (profile && profile.role === 'emprendedor') {
        this.storageKey = `ucv_market_seller_read_notifs_${profile.id}`;
        this.loadReadNotifications();
        this.loadSellerData(profile.id);
        this.setupRealtimeSubscription(profile.id);
      } else {
        if (this.channel) {
          this.supabaseService.client.removeChannel(this.channel);
          this.channel = null;
        }
      }
    });
  }

  get currentUserProfile(): Profile | null {
    return this.userProfileSubject.value;
  }

  loadCategories() {
    this.productRepository.getCategories().subscribe({
      next: (categories: Category[]) => {
        this.categoriesSubject.next(categories);
      },
      error: (err) => {
        console.error('Error al cargar categorías:', err);
      }
    });
  }

  refreshData() {
    const profile = this.userProfileSubject.value;
    if (profile) {
      this.loadSellerData(profile.id);
    }
  }

  loadSellerData(sellerId: string) {
    this.loading$.next(true);

    // Aislamiento de errores: si una fuente falla, no debe tumbar el resto de la carga
    const products$ = this.productRepository.getSellerProducts(sellerId).pipe(
      catchError(err => {
        console.error('Error al cargar productos del vendedor:', err);
        return of([] as Product[]);
      })
    );
    const orders$ = this.orderRepository.getSellerOrders(sellerId).pipe(
      catchError(err => {
        console.error('Error al cargar pedidos del vendedor:', err);
        return of([] as Order[]);
      })
    );
    const reviews$ = from(this.supabaseService.client
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('reviewee_id', sellerId)
    ).pipe(
      map((res: any) => res.count || 0),
      catchError(() => of(0))
    );

    forkJoin([products$, orders$, reviews$]).subscribe({
      next: (results: any) => {
        const products = results[0] as Product[];
        const orders = results[1] as Order[];
        const reviewsCount = results[2] as number;
        this.productsSubject.next(products);
        this.allOrdersSubject.next(orders);
        this.processData(products, orders, reviewsCount);
        this.loading$.next(false);
      },
      error: (err) => {
        console.error('Error al cargar datos del vendedor:', err);
        this.loading$.next(false);
      }
    });
  }

  private processData(products: Product[], orders: Order[], reviewsCount: number = 0) {
    let stats: Partial<SellerStats> = {};

    stats.activeProductsCount = products.filter(p => p.is_active).length;
    stats.totalClicks = products.reduce((acc, p) => acc + (p.whatsapp_clicks || 0), 0);

    stats.pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
    stats.rating = reviewsCount > 0 ? (this.userProfileSubject.value?.rating_average || 0) : 0;
    stats.reviewsCount = reviewsCount;

    // Generar Notificaciones Dinámicas
    const newNotifs = [];
    const pendingOrders = orders.filter(o => o.status === 'pending');
    if (pendingOrders.length > 0) {
      newNotifs.push({
        id: 'p-orders',
        title: 'Nuevos pedidos recibidos',
        desc: `Tienes ${pendingOrders.length} pedido(s) esperando tu aprobación.`,
        time: 'Ahora',
        unread: !this.readNotificationIds.has('p-orders'),
        icon: 'bag-handle',
        color: '#E8432D'
      });
    }
    stats.notifications = newNotifs;
    stats.unreadNotifCount = newNotifs.filter(n => n.unread).length;

    stats.totalSales = orders
      .filter(o => o.status === 'completed')
      .reduce((acc, o) => acc + o.total_price, 0);

    const activeOrders = orders
      .filter(o => ['pending', 'accepted', 'preparing', 'ready'].includes(o.status));
    this.activeOrdersSubject.next(activeOrders);

    // Cálculos de Tiempo
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    stats.totalSalesToday = orders
      .filter(o => o.status === 'completed' && o.created_at?.startsWith(todayStr))
      .reduce((acc, o) => acc + o.total_price, 0);

    stats.todayOrdersCount = orders
      .filter(o => o.created_at?.startsWith(todayStr)).length;

    stats.totalOrders = orders.length;

    const totalSalesYesterday = orders
      .filter(o => o.status === 'completed' && o.created_at?.startsWith(yesterdayStr))
      .reduce((acc, o) => acc + o.total_price, 0);

    if (totalSalesYesterday > 0) {
      stats.salesGrowthToday = Math.round((((stats.totalSalesToday || 0) - totalSalesYesterday) / totalSalesYesterday) * 100);
    } else {
      stats.salesGrowthToday = (stats.totalSalesToday || 0) > 0 ? 100 : 0;
    }

    // Process categories, advanced and top products
    this.calculateCategoryStats(orders, stats);
    this.calculateWeeklyStats(orders, stats);
    this.calculateAdvancedStats(orders, products, stats);

    this.statsSubject.next(stats);
  }

  private loadReadNotifications() {
    const stored = localStorage.getItem(this.storageKey);
    this.readNotificationIds.clear();
    if (stored) {
      try {
        const ids = JSON.parse(stored) as string[];
        ids.forEach(id => this.readNotificationIds.add(id));
      } catch (e) {
        console.error('Error loading read notifications:', e);
      }
    }
  }

  private saveReadNotifications() {
    localStorage.setItem(this.storageKey, JSON.stringify(Array.from(this.readNotificationIds)));
  }

  markNotificationAsRead(id: string) {
    this.readNotificationIds.add(id);
    this.saveReadNotifications();
    const stats = this.statsSubject.value;
    if (stats.notifications) {
      const notif = stats.notifications.find(n => n.id === id);
      if (notif && notif.unread) {
        notif.unread = false;
        if (stats.unreadNotifCount && stats.unreadNotifCount > 0) {
          stats.unreadNotifCount--;
        }
        this.statsSubject.next(stats);
      }
    }
  }

  markAllNotificationsAsRead() {
    const stats = this.statsSubject.value;
    if (stats.notifications) {
      stats.notifications.forEach(n => {
        n.unread = false;
        this.readNotificationIds.add(n.id);
      });
      this.saveReadNotifications();
      stats.unreadNotifCount = 0;
      this.statsSubject.next(stats);
    }
  }

  setupRealtimeSubscription(sellerId: string) {
    if (this.channel) {
      this.supabaseService.client.removeChannel(this.channel);
    }

    this.channel = this.supabaseService.client
      .channel(`seller-orders-channel-${sellerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `seller_id=eq.${sellerId}`
        },
        (payload: any) => {
          console.log('Realtime update on seller orders:', payload);
          // Refresca los datos del vendedor automáticamente
          this.loadSellerData(sellerId);
        }
      )
      .subscribe();
  }

  private calculateCategoryStats(orders: Order[], stats: Partial<SellerStats>) {
    const catMap = new Map<string, number>();
    let totalItems = 0;

    orders.filter(o => o.status === 'completed').forEach(order => {
      order.order_items?.forEach((item: any) => {
        if (!item.product) return;
        const cat = this.categoriesSubject.value.find(c => c.id === item.product!.category_id);
        const catName = cat ? cat.name : 'Categoría';
        const currentCount = catMap.get(catName) || 0;
        catMap.set(catName, currentCount + item.quantity);
        totalItems += item.quantity;
      });
    });

    const colors = ['#E8432D', '#FBBF24', '#10B981', '#3B82F6', '#8B5CF6'];
    const rawStats = Array.from(catMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        percent: totalItems > 0 ? Math.round((count / totalItems) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    let cumulativePercent = 0;
    stats.categoryStats = rawStats.map((cat, index) => {
      const percent = cat.percent;
      const cumAngle = (cumulativePercent / 100) * 360 - 90;
      const dashOffset = 314.159 - (percent / 100) * 314.159;
      cumulativePercent += percent;
      return {
        ...cat,
        color: colors[index % colors.length],
        cumAngle,
        dashOffset
      };
    });
  }

  private calculateAdvancedStats(orders: Order[], products: Product[], stats: Partial<SellerStats>) {
    const completedOrders = orders.filter(o => o.status === 'completed');

    stats.avgTicket = completedOrders.length > 0
      ? (stats.totalSales || 0) / completedOrders.length
      : 0;

    const uniqueBuyers = new Set(completedOrders.map(o => o.buyer_id));
    stats.newCustomersCount = uniqueBuyers.size;

    const now = new Date();
    const currentDay = now.getDay();
    const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    const startOfThisWeek = new Date(now.setDate(diff));
    startOfThisWeek.setHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    const thisWeekOrders = completedOrders.filter(o => new Date(o.created_at!) >= startOfThisWeek);
    const lastWeekOrders = completedOrders.filter(o => {
        const d = new Date(o.created_at!);
        return d >= startOfLastWeek && d < startOfThisWeek;
    });

    const incomeThisWeek = thisWeekOrders.reduce((acc, o) => acc + o.total_price, 0);
    const incomeLastWeek = lastWeekOrders.reduce((acc, o) => acc + o.total_price, 0);
    stats.incomeGrowth = this.calculatePercentChange(incomeThisWeek, incomeLastWeek);
    stats.ordersGrowth = this.calculatePercentChange(thisWeekOrders.length, lastWeekOrders.length);

    const ticketThisWeek = thisWeekOrders.length > 0 ? incomeThisWeek / thisWeekOrders.length : 0;
    const ticketLastWeek = lastWeekOrders.length > 0 ? incomeLastWeek / lastWeekOrders.length : 0;
    stats.ticketGrowth = this.calculatePercentChange(ticketThisWeek, ticketLastWeek);

    const customersThisWeek = new Set(thisWeekOrders.map(o => o.buyer_id)).size;
    const customersLastWeek = new Set(lastWeekOrders.map(o => o.buyer_id)).size;
    stats.customerGrowth = this.calculatePercentChange(customersThisWeek, customersLastWeek);

    const productMap = new Map<string, { name: string, total: number, qty: number, image_url: string }>();
    products.forEach(p => {
      productMap.set(p.id, { name: p.name, total: 0, qty: 0, image_url: p.product_images?.[0]?.image_url || 'assets/images/placeholder-food.png' });
    });

    completedOrders.forEach(order => {
      order.order_items?.forEach((item: any) => {
        if (!item.product) return;
        const current = productMap.get(item.product.id) || { name: item.product.name, total: 0, qty: 0, image_url: item.product.product_images?.[0]?.image_url || 'assets/images/placeholder-food.png' };
        current.total += (item.product.price * item.quantity);
        current.qty += item.quantity;
        productMap.set(item.product.id, current);
      });
    });

    stats.topProducts = Array.from(productMap.values())
      .sort((a, b) => b.total - a.total)
      .map(p => ({ ...p, percent: 0 }));

    if (stats.topProducts.length > 0) {
      const maxTotal = Math.max(...stats.topProducts.map(p => p.total), 1);
      stats.topProducts.forEach(p => p.percent = (p.total / maxTotal) * 100);
    }
  }

  private calculatePercentChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  private calculateWeeklyStats(orders: Order[], stats: Partial<SellerStats>) {
    const weekData = [
      { day: 'L', ventas: 0, dayIndex: 1 },
      { day: 'M', ventas: 0, dayIndex: 2 },
      { day: 'X', ventas: 0, dayIndex: 3 },
      { day: 'J', ventas: 0, dayIndex: 4 },
      { day: 'V', ventas: 0, dayIndex: 5 },
      { day: 'S', ventas: 0, dayIndex: 6 },
      { day: 'D', ventas: 0, dayIndex: 0 },
    ];

    const now = new Date();
    const currentDay = now.getDay();
    const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    let totalThisWeek = 0;
    let totalLastWeek = 0;

    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    orders.forEach(order => {
      if (!order.created_at || order.status !== 'completed') return;
      const orderDate = new Date(order.created_at);
      if (orderDate >= startOfWeek) {
        const dayIdx = orderDate.getDay();
        const dataPoint = weekData.find(d => d.dayIndex === dayIdx);
        if (dataPoint) dataPoint.ventas++;
        totalThisWeek++;
      } else if (orderDate >= startOfLastWeek && orderDate < startOfWeek) {
        totalLastWeek++;
      }
    });

    stats.salesData = weekData.map(({ day, ventas }) => ({ day, ventas }));

    if (totalLastWeek > 0) {
      stats.salesGrowthWeekly = Math.round(((totalThisWeek - totalLastWeek) / totalLastWeek) * 100);
    } else {
      stats.salesGrowthWeekly = totalThisWeek > 0 ? 100 : 0;
    }
  }
}
