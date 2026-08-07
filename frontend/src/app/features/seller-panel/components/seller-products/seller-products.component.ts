import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { SellerStateService } from '../../services/seller-state.service';
import { PRODUCT_REPOSITORY, ProductRepository } from '../../../../core/repositories/product.repository';
import { Product } from '../../../../core/models/product.model';

@Component({
  selector: 'app-seller-products',
  templateUrl: './seller-products.component.html',
  styleUrls: ['./seller-products.component.scss'],
  standalone: false
})
export class SellerProductsComponent {
  private sellerState = inject(SellerStateService);
  private router = inject(Router);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private productRepository = inject(PRODUCT_REPOSITORY);

  products$ = this.sellerState.products$;
  categories$ = this.sellerState.categories$;
  loading$ = this.sellerState.loading$;

  openCreateForm() {
    this.router.navigate(['/seller-panel/product-form']);
  }

  openEditForm(product: Product) {
    this.router.navigate(['/seller-panel/product-form'], { queryParams: { id: product.id } });
  }

  getCategoryName(categoryId: string): string {
    const categories = this.sellerState['categoriesSubject'].value;
    const cat = categories.find((c: any) => c.id === categoryId);
    return cat ? cat.name : 'Categoría';
  }

  async toggleStatus(product: Product) {
    const newStatus = !product.is_active;
    this.productRepository.updateProduct(product.id, { is_active: newStatus }).subscribe({
      next: () => {
        this.showToast(newStatus ? 'Producto activado' : 'Producto pausado', 'success');
        this.sellerState.refreshData();
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
                this.sellerState.refreshData();
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
}
