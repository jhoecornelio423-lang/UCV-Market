import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Product } from '../models/product.model';
import { SupabaseClientService } from '../database/supabase.client';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {
  private favorites = new BehaviorSubject<Product[]>([]);
  public favorites$ = this.favorites.asObservable();
  
  private supabase = inject(SupabaseClientService);
  private authService = inject(AuthService);
  private currentUserId: string | null = null;

  constructor() {
    this.authService.currentProfile$.subscribe(profile => {
      if (profile) {
        this.currentUserId = profile.id;
        this.loadFavoritesFromDB();
      } else {
        this.currentUserId = null;
        this.favorites.next([]);
      }
    });
  }

  private async loadFavoritesFromDB() {
    if (!this.currentUserId) return;
    
    try {
      const { data, error } = await this.supabase.client
        .from('favorites')
        .select(`
          id,
          products (*, product_images(*), seller:profiles(*))
        `)
        .eq('user_id', this.currentUserId);
        
      if (error) throw error;
      
      const favoriteProducts = data
        .filter((f: any) => f.products)
        .map((f: any) => f.products as Product);
        
      this.favorites.next(favoriteProducts);
    } catch (err) {
      console.error('Error loading favorites from DB:', err);
      // Fallback to local storage if DB fails
      this.loadFromStorage();
    }
  }

  getFavorites(): Product[] {
    return this.favorites.getValue();
  }

  async toggleFavorite(product: Product) {
    if (!this.currentUserId) return; // User must be logged in

    const current = this.getFavorites();
    const isFav = current.some(p => p.id === product.id);
    
    // Optimistic UI update
    if (isFav) {
      const updated = current.filter(p => p.id !== product.id);
      this.favorites.next(updated);
      this.saveToStorage(updated);
      
      // Remove from DB
      await this.supabase.client
        .from('favorites')
        .delete()
        .match({ user_id: this.currentUserId, product_id: product.id });
    } else {
      const updated = [...current, product];
      this.favorites.next(updated);
      this.saveToStorage(updated);
      
      // Add to DB
      await this.supabase.client
        .from('favorites')
        .insert({ user_id: this.currentUserId, product_id: product.id });
    }
  }

  isFavorite(productId: string): boolean {
    return this.getFavorites().some(p => p.id === productId);
  }
  
  private loadFromStorage() {
    const saved = localStorage.getItem('ucv_favorites');
    if (saved) {
      try {
        this.favorites.next(JSON.parse(saved));
      } catch (e) { }
    }
  }
  
  private saveToStorage(items: Product[]) {
    localStorage.setItem('ucv_favorites', JSON.stringify(items));
  }
}
