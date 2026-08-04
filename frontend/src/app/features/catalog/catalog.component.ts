import { Component, OnInit, OnDestroy, inject, Inject } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { ToastController } from '@ionic/angular';
import { Router } from '@angular/router';

import { Product } from '../../core/models/product.model';
import { Category } from '../../core/models/category.model';
import { PRODUCT_REPOSITORY, ProductRepository } from '../../core/repositories/product.repository';
import { CartService } from '../../core/cart/cart.service';
import { AuthService } from '../../core/auth/auth.service';
import { Profile } from '../../core/models/profile.model';

@Component({
  selector: 'app-catalog',
  templateUrl: './catalog.component.html',
  standalone: false
})
export class CatalogComponent implements OnInit, OnDestroy {
  products: Product[] = [];
  categories: Category[] = [];
  
  selectedCategoryId: string = '';
  searchQuery: string = '';
  loading = false;
  userProfile: Profile | null = null;
  cartCount = 0;

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
    return `${parts[0]} ${parts[parts.length - 1]}`;
  }

  get featuredProduct(): Product | null {
    return this.products.length > 0 ? this.products[0] : null;
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

  constructor(
    @Inject(PRODUCT_REPOSITORY) private productRepository: ProductRepository
  ) {}

  ngOnInit() {
    this.loadCategories();
    this.loadProducts();

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
              this.router.navigate(['/cart']);
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
    const message = `Hola, te escribo desde UCV Market 🛒.\n\nSoy el comprador *${buyerName}* y vi tu publicación de *${product.name}* (S/. ${product.price.toFixed(2)}). ¿Sigue disponible?`;
    const waUrl = `https://wa.me/51${product.seller.phone}?text=${encodeURIComponent(message)}`;
    
    window.open(waUrl, '_blank');
  }

  /**
   * Redirige al checkout/carrito.
   */
  goToCart() {
    this.router.navigate(['/cart']);
  }

  goToOrders() {
    this.router.navigate(['/orders']);
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }

  signOut() {
    this.authService.signOut().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }
}
