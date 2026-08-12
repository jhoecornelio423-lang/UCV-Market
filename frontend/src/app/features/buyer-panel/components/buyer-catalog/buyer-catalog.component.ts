import { Component, OnInit, OnDestroy, inject, Inject, AfterViewInit, HostListener } from '@angular/core';
import { Subject, Subscription, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { ToastController } from '@ionic/angular';
import { Router } from '@angular/router';

import { Product } from '../../../../core/models/product.model';
import { Category } from '../../../../core/models/category.model';
import { PRODUCT_REPOSITORY, ProductRepository } from '../../../../core/repositories/product.repository';
import { CartService } from '../../../../core/cart/cart.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { Profile } from '../../../../core/models/profile.model';
import { NotificationService } from '../../../../core/services/notification.service';
import { FavoritesService } from '../../../../core/services/favorites.service';
import { SupabaseClientService } from '../../../../core/database/supabase.client';

@Component({
  selector: 'app-buyer-catalog',
  templateUrl: './buyer-catalog.component.html',
  styleUrls: ['./buyer-catalog.component.scss'],
  standalone: false
})
export class BuyerCatalogComponent implements OnInit, OnDestroy, AfterViewInit {
  products: Product[] = [];
  categories: Category[] = [];
  unreadCount$: Observable<number>;
  notifications$: Observable<any[]>;
  showNotifDropdown = false;

  selectedCategoryId: string = '';
  searchQuery: string = '';
  loading = false;
  userProfile: Profile | null = null;
  cartCount = 0;

  featuredProductIndex = 0;
  private carouselInterval: any;
  private touchStartX = 0;
  private touchEndX = 0;

  get greeting(): string {
    const currentHour = new Date().getHours();

    if (currentHour >= 5 && currentHour < 12) return 'Buenos días';
    if (currentHour >= 12 && currentHour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  get displayName(): string {
    const parts = (this.userProfile?.full_name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 0) return 'Estudiante UCV';
    if (parts.length === 1) return parts[0];
    if (parts.length === 3) return `${parts[0]} ${parts[1]}`;
    if (parts.length >= 4) return `${parts[0]} ${parts[2]}`;
    return `${parts[0]} ${parts[1]}`; // Default for 2 words
  }

  get featuredProducts(): Product[] {
    return this.products.slice(0, 3);
  }

  getFeaturedClass(index: number): string {
    const N = this.featuredProducts.length;
    if (N === 0) return '';
    const diff = (index - (this.featuredProductIndex % N) + N) % N;
    
    if (diff === 0) return 'card-active';
    if (diff === 1) return 'card-next';
    if (diff === 2) return 'card-back';
    return 'card-hidden';
  }

  get popularProducts(): Product[] {
    return this.products.slice(0, 8);
  }

  get nearbyProducts(): Product[] {
    return this.products.slice(0, 4);
  }

  // Reactividad para la barra de búsqueda
  private searchSubject = new Subject<string>();
  private subscriptions = new Subscription();

  private cartService = inject(CartService);
  private authService = inject(AuthService);
  private toastCtrl = inject(ToastController);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private favoritesService = inject(FavoritesService);
  private supabaseService = inject(SupabaseClientService);
  
  private realtimeChannel: any = null;

  constructor(
    @Inject(PRODUCT_REPOSITORY) private productRepository: ProductRepository
  ) {
    this.unreadCount$ = this.notificationService.unreadCount$;
    this.notifications$ = this.notificationService.notifications$;
  }

  ngOnInit() {
    this.loadCategories();
    this.loadProducts();

    // Suscribir al canal de tiempo real para la tabla de productos
    this.realtimeChannel = this.supabaseService.client
      .channel('catalog-products-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        console.log('Realtime product update detected on catalog:', payload);
        this.loadProducts();
      })
      .subscribe();

    // Escuchar el perfil del usuario actual (campus, etc.)
    this.subscriptions.add(
      this.authService.currentProfile$.subscribe(profile => {
        this.userProfile = profile;
      })
    );

    // Escuchar cambios en la cantidad de elementos del carrito
    this.subscriptions.add(
      this.cartService.getCartCount$().subscribe(count => {
        this.cartCount = count;
      })
    );

    // Configurar el buscador reactivo con Debounce para optimizar PostgREST
    this.subscriptions.add(
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => this.loading = true),
        switchMap(query => this.productRepository.getActiveProducts(this.selectedCategoryId, query))
      ).subscribe({
        next: (products) => {
          this.products = products;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error al realizar la búsqueda:', err);
          this.loading = false;
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    this.stopCarousel();
    if (this.realtimeChannel) {
      this.supabaseService.client.removeChannel(this.realtimeChannel);
    }
  }

  ngAfterViewInit() {
    this.startCarousel();
  }

  ionViewDidEnter() {
    this.startCarousel();
  }

  ionViewWillLeave() {
    this.stopCarousel();
  }

  private startCarousel() {
    this.stopCarousel(); // Evitar duplicados
    this.carouselInterval = setInterval(() => {
      if (this.products.length > 0) {
        this.nextFeatured();
      }
    }, 4000); // Rotar cada 4 segundos
  }

  private stopCarousel() {
    if (this.carouselInterval) {
      clearInterval(this.carouselInterval);
      this.carouselInterval = null;
    }
  }

  private resetCarouselInterval() {
    this.stopCarousel();
    this.startCarousel();
  }

  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent) {
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipe();
  }

  private handleSwipe() {
    const threshold = 40;
    if (this.touchEndX < this.touchStartX - threshold) {
      // Swipe a la izquierda -> siguiente
      this.nextFeatured();
      this.resetCarouselInterval();
    } else if (this.touchEndX > this.touchStartX + threshold) {
      // Swipe a la derecha -> anterior
      this.prevFeatured();
      this.resetCarouselInterval();
    }
  }

  nextFeatured() {
    this.featuredProductIndex++;
  }

  prevFeatured() {
    const N = this.featuredProducts.length;
    if (N > 0) {
      // Evitar índices negativos en JS
      this.featuredProductIndex = (this.featuredProductIndex - 1 + N) % N;
    }
  }



  /**
   * Carga la lista completa de categorías desde Supabase.
   */
  loadCategories() {
    this.productRepository.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
      },
      error: (err) => {
        console.error('Error al cargar categorías:', err);
      }
    });
  }

  /**
   * Carga los productos activos del catálogo.
   */
  loadProducts() {
    this.loading = true;
    this.productRepository.getActiveProducts(this.selectedCategoryId, this.searchQuery).subscribe({
      next: (products) => {
        console.log('DEBUG: Productos del catálogo:', products);
        this.products = products;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar productos:', err);
        this.loading = false;
      }
    });
  }

  /**
   * Filtra el catálogo al hacer click en una categoría (chip).
   */
  selectCategory(categoryId: string) {
    // Si hace click en la ya seleccionada, se deselecciona (mostrar todo)
    this.selectedCategoryId = this.selectedCategoryId === categoryId ? '' : categoryId;
    this.loadProducts();
  }

  /**
   * Dispara el flujo reactivo de búsqueda ante la pulsación de teclas.
   */
  onSearchChange(event: any) {
    this.searchQuery = event.target.value || '';
    this.searchSubject.next(this.searchQuery);
  }

  getProductImage(product: Product): string {
    return product.product_images?.[0]?.image_url || 'assets/images/login-food-banner.jpg';
  }

  getCategoryIcon(categoryName: string): string {
    const name = (categoryName || '').toLowerCase();
    if (name.includes('bebida') || name.includes('jugo') || name.includes('refresco')) return 'cafe-outline';
    if (name.includes('postre') || name.includes('dulce') || name.includes('torta')) return 'ice-cream-outline';
    if (name.includes('snack') || name.includes('piqueo') || name.includes('fritura')) return 'fast-food-outline';
    if (name.includes('saludable') || name.includes('ensalada')) return 'leaf-outline';
    if (name.includes('desayuno')) return 'sunny-outline';
    if (name.includes('menú') || name.includes('comida') || name.includes('almuerzo')) return 'restaurant-outline';
    return 'restaurant-outline'; // fallback genérico
  }

  /**
   * Agrega el artículo seleccionado al carrito de compras local.
   */
  async addToCart(product: Product) {
    const success = this.cartService.addToCart(product, 1);

    if (success) {
      const toast = await this.toastCtrl.create({
        message: `¡${product.name} agregado al carrito!`,
        duration: 1500,
        position: 'bottom',
        color: 'success',
        buttons: [
          {
            text: 'Ver',
            handler: () => {
              this.router.navigate(['/buyer-panel/cart']);
            }
          }
        ]
      });
      await toast.present();
    } else {
      const toast = await this.toastCtrl.create({
        message: 'No hay más stock disponible de este producto.',
        duration: 2000,
        position: 'bottom',
        color: 'danger'
      });
      await toast.present();
    }
  }

  /**
   * Redirige a WhatsApp del emprendedor generando un link con mensaje rápido de interés.
   */
  contactSellerViaWhatsApp(product: Product) {
    if (!product.seller || !product.seller.phone) {
      this.toastCtrl.create({
        message: 'El teléfono del vendedor no está registrado.',
        duration: 2000,
        color: 'warning'
      }).then(t => t.present());
      return;
    }

    // Incrementar analítica de clics
    this.productRepository.incrementWhatsAppClicks(product.id).subscribe();

    const buyerName = this.userProfile?.full_name || 'Estudiante UCV';
    const message = `Hola, te escribo desde VALLE-GO.\n\nSoy el comprador *${buyerName}* y vi tu publicación de *${product.name}* (S/. ${product.price.toFixed(2)}). ¿Sigue disponible?`;
    const waUrl = `https://wa.me/51${product.seller.phone}?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
  }

  /**
   * Redirige al checkout/carrito.
   */
  goToCart() {
    this.router.navigate(['/buyer-panel/cart']);
  }

  goToCatalog() {
    this.router.navigate(['/buyer-panel/catalog']);
  }

  goToOrders() {
    this.router.navigate(['/buyer-panel/orders']);
  }

  goToSellerDashboard() {
    this.router.navigate(['/seller']);
  }

  goToProfile() {
    this.router.navigate(['/buyer-panel/profile']);
  }

  goToNotifications(event: Event) {
    event.stopPropagation();
    if (window.innerWidth >= 860) {
      this.showNotifDropdown = !this.showNotifDropdown;
    } else {
      this.router.navigate(['/buyer-panel/notifications']);
    }
  }

  markAllRead() {
    this.notificationService.markAllAsRead();
  }

  onNotificationClick(notif: any) {
    this.showNotifDropdown = false;
    if (notif.order_id) {
      this.router.navigate(['/buyer-panel/orders']);
    }
  }

  @HostListener('document:click')
  closeDropdown() {
    this.showNotifDropdown = false;
  }

  signOut() {
    this.authService.signOut().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }

  toggleFavorite(product: Product, event: Event) {
    event.stopPropagation();
    this.favoritesService.toggleFavorite(product);
  }

  isFavorite(productId: string): boolean {
    return this.favoritesService.isFavorite(productId);
  }
}
