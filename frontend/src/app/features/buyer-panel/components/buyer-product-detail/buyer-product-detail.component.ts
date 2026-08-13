import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Product } from '../../../../core/models/product.model';
import { PRODUCT_REPOSITORY } from '../../../../core/repositories/product.repository';
import { CartService } from '../../../../core/cart/cart.service';
import { FavoritesService } from '../../../../core/services/favorites.service';
import { ToastController, AlertController } from '@ionic/angular';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-buyer-product-detail',
  templateUrl: './buyer-product-detail.component.html',
  styleUrls: ['./buyer-product-detail.component.scss'],
  standalone: false
})
export class BuyerProductDetailComponent implements OnInit {
  product: Product | null = null;
  loading = true;
  quantity = 1;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cartService = inject(CartService);
  private favoritesService = inject(FavoritesService);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private authService = inject(AuthService);
  private productRepository = inject(PRODUCT_REPOSITORY);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadProduct(id);
    }
  }

  loadProduct(id: string) {
    this.productRepository.getProductById(id).subscribe({
      next: product => {
        this.product = product;
        this.loading = false;
      },
      error: () => {
        this.product = null;
        this.loading = false;
      }
    });
  }

  goBack() {
    this.router.navigate(['/buyer-panel/catalog']); // fallback, could use Location.back()
  }

  toggleFavorite() {
    if (this.product) {
      this.favoritesService.toggleFavorite(this.product);
    }
  }

  isFavorite(): boolean {
    return this.product ? this.favoritesService.isFavorite(this.product.id) : false;
  }

  getProductImage(): string {
    return this.product?.product_images?.[0]?.image_url || 'assets/images/placeholder-food.png';
  }

  increaseQty() {
    if (this.product && this.quantity < this.product.stock) {
      this.quantity++;
    }
  }

  decreaseQty() {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  async addToCart() {
    if (!this.product) return;
    
    const success = this.cartService.addToCart(this.product, this.quantity);
    if (success) {
      const toast = await this.toastCtrl.create({
        message: `¡Agregado al carrito!`,
        duration: 2000,
        color: 'success',
        position: 'bottom'
      });
      await toast.present();
      this.router.navigate(['/buyer-panel/cart']);
    } else {
      const toast = await this.toastCtrl.create({
        message: 'No hay suficiente stock.',
        duration: 2000,
        color: 'danger',
        position: 'bottom'
      });
      await toast.present();
    }
  }
}
