import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { SellerStateService } from '../../services/seller-state.service';
import { PRODUCT_REPOSITORY, ProductRepository } from '../../../../core/repositories/product.repository';
import { Product } from '../../../../core/models/product.model';

@Component({
  selector: 'app-seller-product-form',
  templateUrl: './seller-product-form.component.html',
  styleUrls: ['./seller-product-form.component.scss'],
  standalone: false
})
export class SellerProductFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sellerState = inject(SellerStateService);
  private productRepository = inject(PRODUCT_REPOSITORY);
  private loadingCtrl = inject(LoadingController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  categories$ = this.sellerState.categories$;

  formMode: 'create' | 'edit' = 'create';
  selectedProductId: string | null = null;

  pName: string = '';
  pDescription: string = '';
  pPrice: number = 0;
  pStock: number = 20;
  pCategoryId: string = '';
  pPickupLocation: string = 'Biblioteca Pabellón A';
  pIsActive: boolean = true;
  pPreparationTime: string = '10 min';
  selectedFiles: File[] = [];
  previewImageUrl: string | null = null;

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.formMode = 'edit';
        this.selectedProductId = id;
        this.loadProductData(id);
      } else {
        this.formMode = 'create';
        this.resetForm();
      }
    });
  }

  loadProductData(id: string) {
    const products = this.sellerState['productsSubject'].value;
    const product = products.find((p: Product) => p.id === id);
    if (product) {
      this.pName = product.name;
      this.pDescription = product.description || '';
      this.pPrice = product.price;
      this.pStock = product.stock;
      this.pCategoryId = product.category_id;
      this.pPickupLocation = product.pickup_location;
      this.pIsActive = product.is_active;
      this.previewImageUrl = product.product_images && product.product_images.length > 0
        ? product.product_images[0].image_url
        : null;
      this.selectedFiles = [];
    }
  }

  resetForm() {
    this.selectedProductId = null;
    this.pName = '';
    this.pDescription = '';
    this.pPrice = 0;
    this.pStock = 20;
    this.pIsActive = true;
    this.pPreparationTime = '10 min';
    this.pPickupLocation = 'Biblioteca Pabellón A';
    const categories = this.sellerState['categoriesSubject'].value;
    if (categories.length > 0) {
      this.pCategoryId = categories[0].id;
    }
    this.selectedFiles = [];
    this.previewImageUrl = null;
  }

  closeForm() {
    this.router.navigate(['/seller/products']);
  }

  onFileChange(event: any) {
    if (event.target.files && event.target.files.length > 0) {
      this.handleFiles(event.target.files);
    }
  }

  onFileDropped(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleFiles(event.dataTransfer.files);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  private handleFiles(files: FileList) {
    const file = files[0];
    if (file && file.type.startsWith('image/')) {
      this.selectedFiles = [file];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.previewImageUrl = e.target.result;
      };
      reader.readAsDataURL(file);
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
          this.sellerState.refreshData();
          this.closeForm();
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
          this.sellerState.refreshData();
          this.closeForm();
        },
        error: (err) => {
          loading.dismiss();
          this.showErrorAlert('Error al actualizar producto', err.message);
        }
      });
    }
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
}
