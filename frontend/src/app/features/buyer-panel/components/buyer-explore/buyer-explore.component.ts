import { Component, OnInit, OnDestroy, inject, Inject, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map, startWith, switchMap } from 'rxjs/operators';
import { PRODUCT_REPOSITORY, ProductRepository } from '../../../../core/repositories/product.repository';
import { AUTH_REPOSITORY, AuthRepository } from '../../../../core/repositories/auth.repository';
import { Product } from '../../../../core/models/product.model';
import { Category } from '../../../../core/models/category.model';
import { Profile } from '../../../../core/models/profile.model';
import { FavoritesService } from '../../../../core/services/favorites.service';
import { SupabaseClientService } from '../../../../core/database/supabase.client';

@Component({
  selector: 'app-buyer-explore',
  templateUrl: './buyer-explore.component.html',
  styleUrls: ['./buyer-explore.component.scss'],
  standalone: false
})
export class BuyerExploreComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private favoritesService = inject(FavoritesService);
  private supabaseService = inject(SupabaseClientService);

  private realtimeChannel: any = null;
  
  constructor(
    @Inject(PRODUCT_REPOSITORY) private productRepository: ProductRepository,
    @Inject(AUTH_REPOSITORY) private authRepository: AuthRepository
  ) {}

  categories: Category[] = [];
  sellers: Profile[] = [];
  
  // State for filtering
  selectedCategoryId$ = new BehaviorSubject<string | null>(null);
  searchTerm$ = new BehaviorSubject<string>('');
  sortBy$ = new BehaviorSubject<string>('none');
  onlyAvailable$ = new BehaviorSubject<boolean>(false);
  showFiltersModal = false;

  filteredProducts$!: Observable<Product[]>;

  // Simulate distances and times since they aren't in DB yet
  simulatedDistances = [120, 200, 350, 500, 800, 1200];
  simulatedTimes = [10, 15, 20, 30, 45];

  ngOnInit() {
    this.loadInitialData();

    // Suscribir al canal de tiempo real para la tabla de productos
    this.realtimeChannel = this.supabaseService.client
      .channel('explore-products-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        console.log('Realtime product update detected on explore:', payload);
        // Disparar recarga del stream reactivo
        this.searchTerm$.next(this.searchTerm$.value);
      })
      .subscribe();

    // Combine filters and fetch products dynamically
    this.filteredProducts$ = combineLatest([
      this.selectedCategoryId$,
      this.searchTerm$.pipe(startWith('')),
      this.sortBy$,
      this.onlyAvailable$
    ]).pipe(
      switchMap(([categoryId, search, sortBy, onlyAvailable]) => 
        this.productRepository.getActiveProducts(categoryId || undefined, search || undefined).pipe(
          map(products => {
            let result = [...products];
            
            // Filter by stock if requested
            if (onlyAvailable) {
              result = result.filter(p => p.stock > 0);
            }
            
            // Apply sorting
            if (sortBy === 'price-asc') {
              result.sort((a, b) => a.price - b.price);
            } else if (sortBy === 'price-desc') {
              result.sort((a, b) => b.price - a.price);
            } else if (sortBy === 'rating-desc') {
              result.sort((a, b) => {
                const rA = a.seller?.rating_average || 5.0;
                const rB = b.seller?.rating_average || 5.0;
                return rB - rA;
              });
            }
            
            return result;
          })
        )
      )
    );
  }

  ngOnDestroy() {
    if (this.realtimeChannel) {
      this.supabaseService.client.removeChannel(this.realtimeChannel);
    }
  }

  loadInitialData() {
    this.productRepository.getCategories().subscribe(cats => {
      this.categories = cats;
    });

    this.authRepository.getSellers().subscribe(sellers => {
      this.sellers = sellers;
    });
  }

  selectCategory(categoryId: string | null) {
    this.selectedCategoryId$.next(categoryId);
  }

  onSearch(event: any) {
    const term = event.target.value;
    this.searchTerm$.next(term);
  }

  getSimulatedDistance(id: string): string {
    // Generate a consistent pseudo-random distance based on string hash
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % this.simulatedDistances.length;
    return `${this.simulatedDistances[idx]} m`;
  }

  getSimulatedTime(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % this.simulatedTimes.length;
    return `${this.simulatedTimes[idx]} min`;
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

  toggleFavorite(product: Product, event: Event) {
    event.stopPropagation();
    this.favoritesService.toggleFavorite(product);
  }

  isFavorite(productId: string): boolean {
    return this.favoritesService.isFavorite(productId);
  }

  toggleFilters(event: Event) {
    event.stopPropagation();
    this.showFiltersModal = !this.showFiltersModal;
  }

  setSortBy(val: string) {
    this.sortBy$.next(val);
  }

  toggleOnlyAvailable(event: any) {
    this.onlyAvailable$.next(event.target.checked);
  }

  resetFilters() {
    this.sortBy$.next('none');
    this.onlyAvailable$.next(false);
    this.showFiltersModal = false;
  }

  @HostListener('document:click')
  closeFilters() {
    this.showFiltersModal = false;
  }
}
