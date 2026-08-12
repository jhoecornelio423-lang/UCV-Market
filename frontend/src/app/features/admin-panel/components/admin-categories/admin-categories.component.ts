import { Component, OnInit, inject, Inject } from '@angular/core';
import { AlertController, ToastController, LoadingController } from '@ionic/angular';
import { PRODUCT_REPOSITORY, ProductRepository } from '../../../../core/repositories/product.repository';
import { Category } from '../../../../core/models/category.model';

@Component({
  selector: 'app-admin-categories',
  templateUrl: './admin-categories.component.html',
  styleUrls: ['./admin-categories.component.scss'],
  standalone: false
})
export class AdminCategoriesComponent implements OnInit {
  categories: Category[] = [];
  loading = false;

  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);

  constructor(
    @Inject(PRODUCT_REPOSITORY) private productRepository: ProductRepository
  ) {}

  ngOnInit() {
    this.loadCategories();
  }

  loadCategories() {
    this.loading = true;
    this.productRepository.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar categorías:', err);
        this.loading = false;
      }
    });
  }

  async addCategory() {
    const alert = await this.alertCtrl.create({
      header: 'Nueva Categoría',
      message: 'Registra una categoría para ordenar los productos del catálogo:',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Nombre (Ej. Ropa y Moda)'
        },
        {
          name: 'icon',
          type: 'text',
          placeholder: 'Emoji / Icono (Ej. 👕)'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Crear',
          handler: (data) => {
            const name = data.name?.trim();
            const icon = data.icon?.trim();

            if (!name || !icon) {
              this.showToast('Por favor completa todos los campos.', 'warning');
              return false;
            }

            this.executeCategoryCreation(name, icon);
            return true;
          }
        }
      ],
      cssClass: 'custom-alert'
    });
    await alert.present();
  }

  private async executeCategoryCreation(name: string, icon: string) {
    const loading = await this.loadingCtrl.create({
      message: 'Creando categoría...',
      spinner: 'crescent'
    });
    await loading.present();

    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    this.productRepository.createCategory(name, slug, icon).subscribe({
      next: () => {
        loading.dismiss();
        this.showToast('Categoría creada exitosamente.', 'success');
        this.loadCategories();
      },
      error: (err) => {
        loading.dismiss();
        this.showToast(err.message || 'Error al crear la categoría.', 'danger');
      }
    });
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
