import { Component, OnInit, inject } from '@angular/core';
import { AdminRepository } from '../../../../core/repositories/admin.repository';
import { Product } from '../../../../core/models/product.model';
import { ToastController, AlertController } from '@ionic/angular';

@Component({
  selector: 'app-admin-products',
  templateUrl: './admin-products.component.html',
  styleUrls: ['./admin-products.component.scss'],
  standalone: false
})
export class AdminProductsComponent implements OnInit {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  categories: { id: string, name: string }[] = [];
  
  loading = true;
  searchTerm = '';
  activeCategoryId: string = 'all';

  private adminRepo = inject(AdminRepository);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    this.loading = true;
    this.adminRepo.getProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.extractCategories();
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar productos:', err);
        this.loading = false;
      }
    });
  }

  extractCategories() {
    const catMap = new Map<string, string>();
    this.products.forEach(p => {
      if (p.category && p.category.id) {
        catMap.set(p.category.id, p.category.name);
      }
    });
    this.categories = Array.from(catMap.entries()).map(([id, name]) => ({ id, name }));
  }

  setCategoryFilter(categoryId: string) {
    this.activeCategoryId = categoryId;
    this.applyFilters();
  }

  applyFilters() {
    let result = [...this.products];

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(p => 
        (p.name?.toLowerCase().includes(term)) ||
        (p.seller?.business_name?.toLowerCase().includes(term)) ||
        (p.seller?.full_name?.toLowerCase().includes(term))
      );
    }

    if (this.activeCategoryId !== 'all') {
      result = result.filter(p => p.category_id === this.activeCategoryId);
    }
    
    this.filteredProducts = result;
  }

  toggleProductStatus(product: Product) {
    const newStatus = !product.is_active;
    product.is_active = newStatus;
    
    this.adminRepo.updateProductStatus(product.id, newStatus).subscribe({
      next: () => {
        this.showToast(`Producto ${newStatus ? 'activado' : 'desactivado'}`);
      },
      error: () => {
        product.is_active = !newStatus;
        this.showToast('Error al cambiar el estado del producto', 'danger');
      }
    });
  }

  async confirmDelete(product: Product) {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar Producto',
      message: `¿Estás seguro de que deseas eliminar permanentemente el producto "${product.name}"? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { 
          text: 'Eliminar', 
          role: 'destructive',
          handler: () => {
            this.adminRepo.deleteProduct(product.id).subscribe({
              next: () => {
                this.showToast('Producto eliminado exitosamente', 'success');
                this.loadProducts();
              },
              error: () => this.showToast('Error al eliminar el producto', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  private async showToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}
