import { Component, OnInit, OnDestroy, inject, Inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AUTH_REPOSITORY, AuthRepository } from '../../../../core/repositories/auth.repository';
import { PRODUCT_REPOSITORY, ProductRepository } from '../../../../core/repositories/product.repository';
import { Profile } from '../../../../core/models/profile.model';
import { Product } from '../../../../core/models/product.model';
import { FavoritesService } from '../../../../core/services/favorites.service';
import { SupabaseClientService } from '../../../../core/database/supabase.client';

@Component({
  selector: 'app-buyer-seller-store',
  templateUrl: './buyer-seller-store.component.html',
  styleUrls: ['./buyer-seller-store.component.scss'],
  standalone: false
})
export class BuyerSellerStoreComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private favoritesService = inject(FavoritesService);
  private supabaseService = inject(SupabaseClientService);

  seller: Profile | null = null;
  products: Product[] = [];
  loading = true;
  realtimeChannel: any = null;

  // Pseudo-random variables for nice UI info
  simulatedDistance = '150 m';
  simulatedTime = '15 min';

  constructor(
    @Inject(AUTH_REPOSITORY) private authRepository: AuthRepository,
    @Inject(PRODUCT_REPOSITORY) private productRepository: ProductRepository
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadStoreData(id);

      // Suscribir al canal de tiempo real para cambios de productos de este vendedor
      this.realtimeChannel = this.supabaseService.client
        .channel(`store-${id}-products-realtime`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `seller_id=eq.${id}` }, (payload) => {
          console.log('Realtime product update detected on store:', payload);
          this.loadSellerProducts(id);
        })
        .subscribe();
    } else {
      this.loading = false;
    }
  }

  ngOnDestroy() {
    if (this.realtimeChannel) {
      this.supabaseService.client.removeChannel(this.realtimeChannel);
    }
  }

  loadStoreData(sellerId: string) {
    this.loading = true;
    this.authRepository.getProfile(sellerId).subscribe({
      next: (profile) => {
        this.seller = profile;
        this.loadSellerProducts(sellerId);
      },
      error: (err) => {
        console.error('Error loading seller profile', err);
        this.loading = false;
      }
    });
  }

  loadSellerProducts(sellerId: string) {
    this.productRepository.getSellerProducts(sellerId).subscribe({
      next: (prods) => {
        // Show only active and in-stock products
        this.products = prods.filter(p => p.is_active && p.stock > 0);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading seller products', err);
        this.loading = false;
      }
    });
  }

  goBack() {
    this.router.navigate(['/buyer-panel/explore']);
  }

  getProductImage(product: Product): string {
    if (product.product_images && product.product_images.length > 0) {
      return product.product_images[0].image_url;
    }
    return 'assets/images/placeholder-food.png';
  }

  toggleFavorite(product: Product, event: Event) {
    event.stopPropagation();
    this.favoritesService.toggleFavorite(product);
  }

  isFavorite(productId: string): boolean {
    return this.favoritesService.isFavorite(productId);
  }
}
