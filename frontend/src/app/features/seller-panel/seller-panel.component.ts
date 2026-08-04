import { Component, OnInit, OnDestroy, inject, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, AlertController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';

import { PRODUCT_REPOSITORY, ProductRepository } from '../../core/repositories/product.repository';
import { ORDER_REPOSITORY, OrderRepository } from '../../core/repositories/order.repository';
import { AuthService } from '../../core/auth/auth.service';
import { Product } from '../../core/models/product.model';
import { Category } from '../../core/models/category.model';
import { Profile } from '../../core/models/profile.model';

@Component({
  selector: 'app-seller-panel',
  templateUrl: './seller-panel.component.html',
  styleUrls: ['./seller-panel.component.scss'],
  standalone: false
})
export class SellerPanelComponent implements OnInit, OnDestroy {
  products: Product[] = [];
  categories: Category[] = [];
  userProfile: Profile | null = null;
  
  // Estadísticas
  totalSales = 0;
  totalClicks = 0;
  pendingOrdersCount = 0;
  activeProductsCount = 0;

  // Control del Formulario de Creación/Edición
  showForm = false;
  formMode: 'create' | 'edit' = 'create';
  selectedProductId: string | null = null;

  // Campos de formulario enlazados
  pName: string = '';
  pDescription: string = '';
  pPrice: number = 0;
  pStock: number = 5;
  pCategoryId: string = '';
  pPickupLocation: string = 'Biblioteca Pabellón A';
  pIsActive: boolean = true;
  selectedFiles: File[] = [];

  private subscriptions = new Subscription();

  private authService = inject(AuthService);
  private router = inject(Router);
  private loadingCtrl = inject(LoadingController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  constructor(
    @Inject(PRODUCT_REPOSITORY) private productRepository: ProductRepository,
    @Inject(ORDER_REPOSITORY) private orderRepository: OrderRepository
  ) {}

  ngOnInit() {
    this.loadCategories();
    this.subscriptions.add(
      this.authService.currentProfile$.subscribe(profile => {
        this.userProfile = profile;
        if (profile) {
          this.loadSellerData(profile.id);
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadCategories() {
    this.productRepository.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        if (categories.length > 0) {
          this.pCategoryId = categories[0].id;
        }
      }
    });
  }

  loadSellerData(sellerId: string) {
    // 1. Cargar productos
    this.productRepository.getSellerProducts(sellerId).subscribe({
      next: (products) => {
        this.products = products;
        this.activeProductsCount = products.filter(p => p.is_active).length;
        this.totalClicks = products.reduce((acc, p) => acc + (p.whatsapp_clicks || 0), 0);
      },
      error: (err) => console.error('Error al cargar productos del vendedor:', err)
    });

    // 2. Cargar ventas para calcular estadísticas
    this.orderRepository.getSellerOrders(sellerId).subscribe({
      next: (orders) => {
        this.pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
        this.totalSales = orders
          .filter(o => o.status === 'completed')
          .reduce((acc, o) => acc + o.total_price, 0);
      },
      error: (err) => console.error('Error al cargar ventas del vendedor:', err)
    });
  }

  openCreateForm() {
    this.formMode = 'create';
    this.selectedProductId = null;
    this.pName = '';
    this.pDescription = '';
    this.pPrice = 0;
    this.pStock = 5;
    this.pIsActive = true;
    this.pPickupLocation = 'Biblioteca Pabellón A';
    if (this.categories.length > 0) {
      this.pCategoryId = this.categories[0].id;
    }
    this.selectedFiles = [];
    this.showForm = true;
  }

  openEditForm(product: Product) {
    this.formMode = 'edit';
    this.selectedProductId = product.id;
    this.pName = product.name;
    this.pDescription = product.description;
    this.pPrice = product.price;
    this.pStock = product.stock;
    this.pCategoryId = product.category_id;
    this.pPickupLocation = product.pickup_location;
    this.pIsActive = product.is_active;
    this.selectedFiles = [];
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
  }

  onFileChange(event: any) {
    if (event.target.files && event.target.files.length > 0) {
      this.selectedFiles = Array.from(event.target.files);
    }
  }

  async saveProduct() {
    if (!this.pName || this.pPrice <= 0 || this.pStock < 0 || !this.pCategoryId) {
      this.showToast('Por favor completa todos los campos requeridos correctamente.', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Guardando producto...',
      spinner: 'crescent'
    });
    await loading.present();

    const productPayload: Partial<Product> = {
      name: this.pName,
      description: this.pDescription,
      price: this.pPrice,
      stock: this.pStock,
      category_id: this.pCategoryId,
      pickup_location: this.pPickupLocation,
      is_active: this.pIsActive
    };

    if (this.formMode === 'create') {
      this.productRepository.createProduct(productPayload, this.selectedFiles).subscribe({
        next: () => {
          loading.dismiss();
          this.showToast('Producto creado con éxito.', 'success');
          this.showForm = false;
          if (this.userProfile) this.loadSellerData(this.userProfile.id);
        },
        error: (err) => {
          loading.dismiss();
          this.showErrorAlert('Error al crear producto', err.message);
        }
      });
    } else if (this.formMode === 'edit' && this.selectedProductId) {
      this.productRepository.updateProduct(this.selectedProductId, productPayload).subscribe({
        next: () => {
          loading.dismiss();
          this.showToast('Producto actualizado con éxito.', 'success');
          this.showForm = false;
          if (this.userProfile) this.loadSellerData(this.userProfile.id);
        },
        error: (err) => {
          loading.dismiss();
          this.showErrorAlert('Error al actualizar producto', err.message);
        }
      });
    }
  }

  async toggleProductActive(product: Product) {
    const updatedStatus = !product.is_active;
    this.productRepository.updateProduct(product.id, { is_active: updatedStatus }).subscribe({
      next: () => {
        this.showToast(
          updatedStatus ? 'Producto activado y visible en catálogo.' : 'Producto pausado del catálogo.', 
          'success'
        );
        if (this.userProfile) this.loadSellerData(this.userProfile.id);
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
                if (this.userProfile) this.loadSellerData(this.userProfile.id);
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

  private async showErrorAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['Entendido'],
      cssClass: 'custom-alert'
    });
    await alert.present();
  }

  goToOrders() {
    this.router.navigate(['/orders']);
  }
}
