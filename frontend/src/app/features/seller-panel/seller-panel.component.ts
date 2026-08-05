import { Component, OnInit, OnDestroy, inject, Inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { LoadingController, AlertController, ToastController } from '@ionic/angular';
import { Subject, Subscription, forkJoin, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

import { PRODUCT_REPOSITORY, ProductRepository } from '../../core/repositories/product.repository';
import { ORDER_REPOSITORY, OrderRepository } from '../../core/repositories/order.repository';
import { AuthService } from '../../core/auth/auth.service';
import { Product } from '../../core/models/product.model';
import { Category } from '../../core/models/category.model';
import { Profile } from '../../core/models/profile.model';
import { Order } from '../../core/models/order.model';

@Component({
  selector: 'app-seller-panel',
  templateUrl: './seller-panel.component.html',
  styleUrls: ['./seller-panel.component.scss'],
  standalone: false
})
export class SellerPanelComponent implements OnInit, OnDestroy {
  products: Product[] = [];
  categories: Category[] = [];
  userProfile: Profile | null = null;

  // Estadísticas
  totalSalesToday = 0;
  totalSales = 0; // Ventas acumuladas históricas
  totalClicks = 0;
  pendingOrdersCount = 0;
  activeProductsCount = 0;

  // Estadísticas Avanzadas
  avgTicket = 0;
  newCustomersCount = 0;
  monthlyData: any[] = [];
  categoryStats: any[] = []; // Nueva estadística proactiva
  currentMonthYear = '';

  activeOrders: Order[] = [];
  salesData = [
    { day: 'L', ventas: 0 },
    { day: 'M', ventas: 0 },
    { day: 'X', ventas: 0 },
    { day: 'J', ventas: 0 },
    { day: 'V', ventas: 0 },
    { day: 'S', ventas: 0 },
    { day: 'D', ventas: 0 },
  ];

  // Métricas de Crecimiento Reales
  salesGrowthToday = 0;
  salesGrowthWeekly = 0;
  ordersGrowth = 0;
  ticketGrowth = 0;
  customerGrowth = 0;
  incomeGrowth = 0;

  topProducts: any[] = [];

  // Vista activa: 'dashboard' | 'products' | 'stats' | 'business'
  activeView: 'dashboard' | 'products' | 'stats' | 'business' = 'dashboard';
  loading = false;

  // Notificaciones
  showNotifDropdown = false;
  unreadNotifCount = 0;
  notifications: any[] = [];

  // Control del Formulario de Creación/Edición
  showForm = false;
  formMode: 'create' | 'edit' = 'create';
  selectedProductId: string | null = null;

  // Campos de formulario enlazados
  pName: string = '';
  pDescription: string = '';
  pPrice: number = 0;
  pStock: number = 5;
  pCategoryId: string = '';
  pPickupLocation: string = 'Biblioteca Pabellón A';
  pIsActive: boolean = true;
  pPreparationTime: string = '10 min';
  selectedFiles: File[] = [];
  previewImageUrl: string | null = null;

  // Datos del Negocio
  bName: string = '';
  bCategory: string = '';
  bDescription: string = '';
  bLocation: string = '';
  bOpenTime: string = '08:00';
  bCloseTime: string = '18:00';
  bPushEnabled: boolean = true;
  businessBannerUrl: string = 'assets/images/login-food-banner.jpg';
  businessAvatarUrl: string = 'assets/images/user-placeholder.jpg';
  selectedBannerFile: File | null = null;
  selectedAvatarFile: File | null = null;

  triggerBannerUpload() {
    document.getElementById('bannerFileInput')?.click();
  }

  triggerAvatarUpload() {
    document.getElementById('avatarFileInput')?.click();
  }

  onBannerSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      this.selectedBannerFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.businessBannerUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  onAvatarSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      this.selectedAvatarFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.businessAvatarUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  private subscriptions = new Subscription();

  private authService = inject(AuthService);
  private router = inject(Router);
  private loadingCtrl = inject(LoadingController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  constructor(
    @Inject(PRODUCT_REPOSITORY) private productRepository: ProductRepository,
    @Inject(ORDER_REPOSITORY) private orderRepository: OrderRepository
  ) {}

  ngOnInit() {
    this.loadCategories();
    this.subscriptions.add(
      this.authService.currentProfile$.subscribe(profile => {
        this.userProfile = profile;
        if (profile) {
          this.loadSellerData(profile.id);
          if (this.activeView === 'business') {
            this.loadBusinessData();
          }
        }
      })
    );

    // Detectar vista desde la URL
    this.subscriptions.add(
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe(() => {
        this.detectActiveView();
      })
    );

    // Detectar vista inicial
    this.detectActiveView();
  }

  detectActiveView() {
    const url = this.router.url;
    if (url.includes('view=products')) {
      this.activeView = 'products';
    } else if (url.includes('view=stats')) {
      this.activeView = 'stats';
    } else if (url.includes('view=business')) {
      this.activeView = 'business';
      this.loadBusinessData();
    } else {
      this.activeView = 'dashboard';
    }
    this.showForm = false;
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadCategories() {
    this.productRepository.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        if (categories.length > 0) {
          this.pCategoryId = categories[0].id;
        }
      }
    });
  }

  loadSellerData(sellerId: string) {
    this.loading = true;

    // Usamos forkJoin para esperar a que AMBAS peticiones terminen y evitar datos vacíos
    const products$ = this.productRepository.getSellerProducts(sellerId);
    const orders$ = this.orderRepository.getSellerOrders(sellerId);

    this.subscriptions.add(
      forkJoin([products$, orders$]).subscribe({
        next: ([products, orders]) => {
          this.products = products;
          this.activeProductsCount = products.filter(p => p.is_active).length;
          this.totalClicks = products.reduce((acc, p) => acc + (p.whatsapp_clicks || 0), 0);

          this.processOrdersData(orders);
          this.loading = false;
        },
        error: (err) => {
          console.error('Error al cargar datos del vendedor:', err);
          this.loading = false;
        }
      })
    );
  }

  private processOrdersData(orders: Order[]) {
    this.pendingOrdersCount = orders.filter(o => o.status === 'pending').length;

    // Generar Notificaciones Dinámicas basadas en Pedidos
    this.generateDynamicNotifications(orders);

    // Ventas totales (histórico)
    this.totalSales = orders
      .filter(o => o.status === 'completed')
      .reduce((acc, o) => acc + o.total_price, 0);

    // Pedidos activos para la lista
    this.activeOrders = orders
      .filter(o => ['pending', 'accepted', 'preparing', 'ready'].includes(o.status))
      .slice(0, 2);

    // Cálculos de Tiempo
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Ventas de Hoy vs Ayer
    this.totalSalesToday = orders
      .filter(o => o.status === 'completed' && o.created_at?.startsWith(todayStr))
      .reduce((acc, o) => acc + o.total_price, 0);

    const totalSalesYesterday = orders
      .filter(o => o.status === 'completed' && o.created_at?.startsWith(yesterdayStr))
      .reduce((acc, o) => acc + o.total_price, 0);

    if (totalSalesYesterday > 0) {
      this.salesGrowthToday = Math.round(((this.totalSalesToday - totalSalesYesterday) / totalSalesYesterday) * 100);
    } else {
      this.salesGrowthToday = this.totalSalesToday > 0 ? 100 : 0;
    }

    // Procesar Estadísticas Detalladas
    this.calculateWeeklyStats(orders);
    this.calculateAdvancedStats(orders);
    this.calculateCategoryStats(orders);
  }

  private calculateCategoryStats(orders: Order[]) {
    const catMap = new Map<string, number>();
    let totalItems = 0;

    orders.filter(o => o.status === 'completed').forEach(order => {
      order.order_items?.forEach(item => {
        if (!item.product) return;
        const catName = this.getCategoryName(item.product.category_id);
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
    this.categoryStats = rawStats.map((cat, index) => {
      const percent = cat.percent;
      const cumAngle = (cumulativePercent / 100) * 360 - 90; // Empezar desde arriba (-90deg)
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

  private calculateAdvancedStats(orders: Order[]) {
    const completedOrders = orders.filter(o => o.status === 'completed');

    // Ticket Promedio
    this.avgTicket = completedOrders.length > 0
      ? this.totalSales / completedOrders.length
      : 0;

    // Clientes (IDs únicos de compradores)
    const uniqueBuyers = new Set(completedOrders.map(o => o.buyer_id));
    this.newCustomersCount = uniqueBuyers.size;

    // --- LÓGICA DE CRECIMIENTO REAL (Semana Actual vs Anterior) ---
    const now = new Date();
    const currentDay = now.getDay();
    const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    const startOfThisWeek = new Date(now.setDate(diff));
    startOfThisWeek.setHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    // Pedidos de esta semana y la anterior
    const thisWeekOrders = completedOrders.filter(o => new Date(o.created_at!) >= startOfThisWeek);
    const lastWeekOrders = completedOrders.filter(o => {
        const d = new Date(o.created_at!);
        return d >= startOfLastWeek && d < startOfThisWeek;
    });

    // 1. Ingresos (Income)
    const incomeThisWeek = thisWeekOrders.reduce((acc, o) => acc + o.total_price, 0);
    const incomeLastWeek = lastWeekOrders.reduce((acc, o) => acc + o.total_price, 0);
    this.incomeGrowth = this.calculatePercentChange(incomeThisWeek, incomeLastWeek);

    // 2. Pedidos (Orders)
    this.ordersGrowth = this.calculatePercentChange(thisWeekOrders.length, lastWeekOrders.length);

    // 3. Ticket Promedio
    const ticketThisWeek = thisWeekOrders.length > 0 ? incomeThisWeek / thisWeekOrders.length : 0;
    const ticketLastWeek = lastWeekOrders.length > 0 ? incomeLastWeek / lastWeekOrders.length : 0;
    this.ticketGrowth = this.calculatePercentChange(ticketThisWeek, ticketLastWeek);

    // 4. Clientes
    const customersThisWeek = new Set(thisWeekOrders.map(o => o.buyer_id)).size;
    const customersLastWeek = new Set(lastWeekOrders.map(o => o.buyer_id)).size;
    this.customerGrowth = this.calculatePercentChange(customersThisWeek, customersLastWeek);

    // Datos Mensuales
    this.monthlyData = [
      { label: 'S1', value: this.totalSales * 0.2 },
      { label: 'S2', value: this.totalSales * 0.3 },
      { label: 'S3', value: this.totalSales * 0.25 },
      { label: 'S4', value: this.totalSales * 0.25 },
    ];

    this.calculateTopProducts(orders);
  }

  private calculatePercentChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  private calculateTopProducts(orders: Order[]) {
    // 1. Inicializar mapa con TODOS los productos del vendedor (Proactivo: mostrar incluso los de 0 ventas)
    const productMap = new Map<string, { name: string, total: number, qty: number }>();

    this.products.forEach(p => {
      productMap.set(p.id, { name: p.name, total: 0, qty: 0 });
    });

    // 2. Sumar ventas reales de pedidos completados
    orders.filter(o => o.status === 'completed').forEach(order => {
      order.order_items?.forEach(item => {
        if (!item.product) return;
        const current = productMap.get(item.product.id) || { name: item.product.name, total: 0, qty: 0 };
        current.total += (item.product.price * item.quantity);
        current.qty += item.quantity;
        productMap.set(item.product.id, current);
      });
    });

    // 3. Convertir a array, ordenar por ventas y calcular porcentajes
    this.topProducts = Array.from(productMap.values())
      .sort((a, b) => b.total - a.total)
      .map(p => ({
        ...p,
        percent: 0
      }));

    if (this.topProducts.length > 0) {
      const maxTotal = Math.max(...this.topProducts.map(p => p.total), 1);
      this.topProducts.forEach(p => p.percent = (p.total / maxTotal) * 100);
    }
  }

  private calculateWeeklyStats(orders: Order[]) {
    // Reset data
    const weekData = [
      { day: 'L', ventas: 0, dayIndex: 1 }, // Lunes
      { day: 'M', ventas: 0, dayIndex: 2 }, // Martes
      { day: 'X', ventas: 0, dayIndex: 3 }, // Miércoles
      { day: 'J', ventas: 0, dayIndex: 4 }, // Jueves
      { day: 'V', ventas: 0, dayIndex: 5 }, // Viernes
      { day: 'S', ventas: 0, dayIndex: 6 }, // Sábado
      { day: 'D', ventas: 0, dayIndex: 0 }, // Domingo
    ];

    const now = new Date();
    // Obtener el lunes de esta semana
    const currentDay = now.getDay(); // 0-6
    const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    let totalThisWeek = 0;
    let totalLastWeek = 0;

    // Calcular fecha de inicio de la semana pasada para comparación
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    orders.forEach(order => {
      if (!order.created_at) return;
      const orderDate = new Date(order.created_at);

      // Solo sumamos al gráfico si es de esta semana
      if (orderDate >= startOfWeek) {
        const dayIdx = orderDate.getDay();
        const dataPoint = weekData.find(d => d.dayIndex === dayIdx);
        if (dataPoint) dataPoint.ventas++;
        totalThisWeek++;
      } else if (orderDate >= startOfLastWeek && orderDate < startOfWeek) {
        totalLastWeek++;
      }
    });

    this.salesData = weekData.map(({ day, ventas }) => ({ day, ventas }));

    if (totalLastWeek > 0) {
      this.salesGrowthWeekly = Math.round(((totalThisWeek - totalLastWeek) / totalLastWeek) * 100);
    } else {
      this.salesGrowthWeekly = totalThisWeek > 0 ? 100 : 0;
    }
  }

  openCreateForm() {
    this.formMode = 'create';
    this.selectedProductId = null;
    this.pName = '';
    this.pDescription = '';
    this.pPrice = 0;
    this.pStock = 20;
    this.pIsActive = true;
    this.pPreparationTime = '10 min';
    this.pPickupLocation = 'Biblioteca Pabellón A';
    if (this.categories.length > 0) {
      this.pCategoryId = this.categories[0].id;
    }
    this.selectedFiles = [];
    this.previewImageUrl = null;
    this.showForm = true;
  }

  openEditForm(product: Product) {
    this.formMode = 'edit';
    this.selectedProductId = product.id;
    this.pName = product.name;
    this.pDescription = product.description || '';
    this.pPrice = product.price;
    this.pStock = product.stock;
    this.pCategoryId = product.category_id;
    this.pPickupLocation = product.pickup_location;
    this.pIsActive = product.is_active;
    this.previewImageUrl = product.product_images && product.product_images.length > 0
      ? product.product_images[0].image_url
      : null;
    this.selectedFiles = [];
    this.showForm = true;
  }

  getCategoryName(categoryId: string): string {
    const cat = this.categories.find(c => c.id === categoryId);
    return cat ? cat.name : 'Categoría';
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

  async toggleStatus(product: Product) {
    const newStatus = !product.is_active;
    this.productRepository.updateProduct(product.id, { is_active: newStatus }).subscribe({
      next: () => {
        product.is_active = newStatus;
        this.showToast(newStatus ? 'Producto activado' : 'Producto pausado', 'success');
      }
    });
  }

  closeForm() {
    this.showForm = false;
  }

  onFileChange(event: any) {
    if (event.target.files && event.target.files.length > 0) {
      this.handleFiles(event.target.files);
    }
  }

  onFileDropped(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleFiles(event.dataTransfer.files);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  private handleFiles(files: FileList) {
    const file = files[0];
    if (file && file.type.startsWith('image/')) {
      this.selectedFiles = [file];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.previewImageUrl = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  async saveProduct() {
    if (!this.pName || this.pPrice <= 0 || this.pStock < 0 || !this.pCategoryId) {
      this.showToast('Por favor completa todos los campos requeridos correctamente.', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Guardando producto...',
      spinner: 'crescent'
    });
    await loading.present();

    const productPayload: Partial<Product> = {
      name: this.pName,
      description: this.pDescription,
      price: this.pPrice,
      stock: this.pStock,
      category_id: this.pCategoryId,
      pickup_location: this.pPickupLocation,
      is_active: this.pIsActive
    };

    if (this.formMode === 'create') {
      this.productRepository.createProduct(productPayload, this.selectedFiles).subscribe({
        next: () => {
          loading.dismiss();
          this.showToast('Producto creado con éxito.', 'success');
          this.showForm = false;
          if (this.userProfile) this.loadSellerData(this.userProfile.id);
        },
        error: (err) => {
          loading.dismiss();
          this.showErrorAlert('Error al crear producto', err.message);
        }
      });
    } else if (this.formMode === 'edit' && this.selectedProductId) {
      this.productRepository.updateProduct(this.selectedProductId, productPayload).subscribe({
        next: () => {
          loading.dismiss();
          this.showToast('Producto actualizado con éxito.', 'success');
          this.showForm = false;
          if (this.userProfile) this.loadSellerData(this.userProfile.id);
        },
        error: (err) => {
          loading.dismiss();
          this.showErrorAlert('Error al actualizar producto', err.message);
        }
      });
    }
  }

  async toggleProductActive(product: Product) {
    const updatedStatus = !product.is_active;
    this.productRepository.updateProduct(product.id, { is_active: updatedStatus }).subscribe({
      next: () => {
        this.showToast(
          updatedStatus ? 'Producto activado y visible en catálogo.' : 'Producto pausado del catálogo.',
          'success'
        );
        if (this.userProfile) this.loadSellerData(this.userProfile.id);
      },
      error: () => this.showToast('Error al modificar disponibilidad.', 'danger')
    });
  }

  async deleteProduct(product: Product) {
    const confirmAlert = await this.alertCtrl.create({
      header: 'Dar de Baja',
      message: `¿Estás seguro de desactivar permanentemente a "${product.name}"? Seguirá viéndose en el historial de pedidos anteriores.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Sí, Inactivar',
          handler: () => {
            this.productRepository.deleteProduct(product.id).subscribe({
              next: () => {
                this.showToast('Producto dado de baja.', 'success');
                if (this.userProfile) this.loadSellerData(this.userProfile.id);
              },
              error: () => this.showToast('Error al eliminar producto.', 'danger')
            });
          }
        }
      ],
      cssClass: 'custom-alert'
    });
    await confirmAlert.present();
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 1500,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  private async showErrorAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['Entendido'],
      cssClass: 'custom-alert'
    });
    await alert.present();
  }

  goToOrders() {
    this.router.navigate(['/orders']);
  }

  signOut() {
    this.authService.signOut().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }

  async showNotifications() {
    this.showNotifDropdown = !this.showNotifDropdown;
  }

  private generateDynamicNotifications(orders: Order[]) {
    const newNotifs = [];
    const pendingOrders = orders.filter(o => o.status === 'pending');

    if (pendingOrders.length > 0) {
      newNotifs.push({
        id: 'p-orders',
        title: 'Nuevos pedidos recibidos 🛒',
        desc: `Tienes ${pendingOrders.length} pedido(s) esperando tu aprobación.`,
        time: 'Ahora',
        unread: true,
        icon: 'bag-handle',
        color: '#E8432D'
      });
    }

    // Agregar algunas notificaciones de sistema para relleno visual (look profesional)
    newNotifs.push({
      id: 'sys-1',
      title: '¡Bienvenido al nivel Pro! ⭐',
      desc: 'Tu reputación ha subido gracias a tus excelentes entregas.',
      time: '1h',
      unread: false,
      icon: 'ribbon',
      color: '#FBBF24'
    });

    this.notifications = newNotifs;
    this.unreadNotifCount = newNotifs.filter(n => n.unread).length;
  }

  markAllRead() {
    this.notifications.forEach(n => n.unread = false);
    this.unreadNotifCount = 0;
  }

  getMaxSales(): number {
    const max = Math.max(...this.salesData.map(d => d.ventas));
    return max > 0 ? max : 10; // Fallback para no dividir por cero
  }

  get svgLinePath(): string {
    const max = this.getMaxSales() || 1;
    const points = this.salesData.map((d, i) => {
      const x = 50 + i * 100;
      const y = 140 - (d.ventas / max) * 110;
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  }

  get svgAreaPath(): string {
    const max = this.getMaxSales() || 1;
    const points = this.salesData.map((d, i) => {
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
    const max = this.getMaxSales() || 1;
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

  loadBusinessData() {
    if (this.userProfile) {
      this.bName = this.userProfile.full_name || 'Mi Emprendimiento';
      this.bDescription = this.userProfile.business_description || 'Postres artesanales hechos con amor cada mañana. Desde brownies hasta cheesecakes, todo es fresco del día.';
      this.bCategory = this.userProfile.business_category || 'Postres & Dulces';
      this.bLocation = this.userProfile.business_location || 'Pabellón A, 1er piso';
      this.bOpenTime = this.userProfile.open_time || '08:00';
      this.bCloseTime = this.userProfile.close_time || '18:00';
      this.businessBannerUrl = this.userProfile.banner_url || 'assets/images/login-food-banner.jpg';
      this.businessAvatarUrl = this.userProfile.avatar_url || 'assets/images/user-placeholder.jpg';
    }
  }

  async saveBusinessInfo() {
    if (!this.userProfile) return;

    const loading = await this.loadingCtrl.create({
      message: 'Guardando datos del negocio...',
      spinner: 'crescent'
    });
    await loading.present();

    const userId = this.userProfile.id;
    const uploadTasks: { [key: string]: Observable<string> } = {};

    if (this.selectedBannerFile) {
      const extension = this.selectedBannerFile.name.split('.').pop() || 'jpg';
      const filePath = `banners/${userId}_banner.${extension}`;
      uploadTasks['banner'] = this.authService.uploadBusinessAsset(filePath, this.selectedBannerFile);
    }

    if (this.selectedAvatarFile) {
      const extension = this.selectedAvatarFile.name.split('.').pop() || 'jpg';
      const filePath = `avatars/${userId}_avatar.${extension}`;
      uploadTasks['avatar'] = this.authService.uploadBusinessAsset(filePath, this.selectedAvatarFile);
    }

    const saveDetails = (bannerUrl?: string, avatarUrl?: string) => {
      const updatedProfile: Partial<Profile> = {
        full_name: this.bName,
        business_description: this.bDescription,
        business_category: this.bCategory,
        business_location: this.bLocation,
        open_time: this.bOpenTime,
        close_time: this.bCloseTime
      };

      if (bannerUrl) updatedProfile.banner_url = bannerUrl;
      if (avatarUrl) updatedProfile.avatar_url = avatarUrl;

      this.authService.updateProfile(updatedProfile).subscribe({
        next: (profile) => {
          this.userProfile = profile;
          this.selectedBannerFile = null;
          this.selectedAvatarFile = null;
          this.loadBusinessData();
          loading.dismiss();
          this.showToast('Datos del negocio guardados con éxito.', 'success');
        },
        error: (err) => {
          loading.dismiss();
          this.showToast(err.message || 'Error al guardar detalles de negocio.', 'danger');
        }
      });
    };

    if (Object.keys(uploadTasks).length > 0) {
      forkJoin(uploadTasks).subscribe({
        next: (results: any) => {
          saveDetails(results.banner, results.avatar);
        },
        error: (err) => {
          loading.dismiss();
          this.showToast(err.message || 'Error al subir imágenes del negocio.', 'danger');
        }
      });
    } else {
      saveDetails();
    }
  }

  getReputationLabel(rating: number | undefined): string {
    const val = rating || 0;
    if (val >= 4.5) return 'Nivel Pro';
    if (val >= 3.5) return 'Vendedor Elite';
    if (val >= 2.5) return 'Confiable';
    return 'Principiante';
  }
}
