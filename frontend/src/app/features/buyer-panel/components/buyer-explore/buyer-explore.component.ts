import { Component, OnInit, inject, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map, startWith, switchMap } from 'rxjs/operators';
import { PRODUCT_REPOSITORY, ProductRepository } from '../../../../core/repositories/product.repository';
import { AUTH_REPOSITORY, AuthRepository } from '../../../../core/repositories/auth.repository';
import { Product } from '../../../../core/models/product.model';
import { Category } from '../../../../core/models/category.model';
import { Profile } from '../../../../core/models/profile.model';
import { FavoritesService } from '../../../../core/services/favorites.service';

@Component({
  selector: 'app-buyer-explore',
  templateUrl: './buyer-explore.component.html',
  styleUrls: ['./buyer-explore.component.scss'],
  standalone: false
})
export class BuyerExploreComponent implements OnInit {
  private router = inject(Router);
  private favoritesService = inject(FavoritesService);
  
  constructor(
    @Inject(PRODUCT_REPOSITORY) private productRepository: ProductRepository,
    @Inject(AUTH_REPOSITORY) private authRepository: AuthRepository
  ) {}

  categories: Category[] = [];
  sellers: Profile[] = [];
  
  // State for filtering
  selectedCategoryId$ = new BehaviorSubject<string | null>(null);
  searchTerm$ = new BehaviorSubject<string>('');

  filteredProducts$!: Observable<Product[]>;

  // Simulate distances and times since they aren't in DB yet
  simulatedDistances = [120, 200, 350, 500, 800, 1200];
  simulatedTimes = [10, 15, 20, 30, 45];

  ngOnInit() {
    this.loadInitialData();

    // Combine filters and fetch products dynamically
    this.filteredProducts$ = combineLatest([
      this.selectedCategoryId$,
      this.searchTerm$.pipe(startWith(''))
    ]).pipe(
      switchMap(([categoryId, search]) => 
        this.productRepository.getActiveProducts(categoryId || undefined, search || undefined)
      )
    );
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
}
