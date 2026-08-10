import { Component, OnInit, inject } from '@angular/core';
import { Product } from '../../../../core/models/product.model';
import { FavoritesService } from '../../../../core/services/favorites.service';

@Component({
  selector: 'app-buyer-favorites',
  templateUrl: './buyer-favorites.component.html',
  styleUrls: ['./buyer-favorites.component.scss'],
  standalone: false
})
export class BuyerFavoritesComponent implements OnInit {
  favorites: Product[] = [];
  
  private favoritesService = inject(FavoritesService);

  constructor() {}

  ngOnInit() {
    this.favoritesService.favorites$.subscribe(items => {
      this.favorites = items;
    });
  }

  getProductImage(product: Product): string {
    return product.product_images?.[0]?.image_url || 'assets/images/placeholder-food.png';
  }

  toggleFavorite(product: Product, event: Event) {
    event.stopPropagation();
    this.favoritesService.toggleFavorite(product);
  }
}
