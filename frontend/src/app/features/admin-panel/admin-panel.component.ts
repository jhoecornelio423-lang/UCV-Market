import { Component, OnInit, inject, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController, LoadingController } from '@ionic/angular';

import { PRODUCT_REPOSITORY, ProductRepository } from '../../core/repositories/product.repository';
import { AuthService } from '../../core/auth/auth.service';
import { Category } from '../../core/models/category.model';
import { Profile } from '../../core/models/profile.model';

@Component({
  selector: 'app-admin-panel',
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.scss'],
  standalone: false
})
export class AdminPanelComponent implements OnInit {
  categories: Category[] = [];
  userProfile: Profile | null = null;
  loading = false;

  private authService = inject(AuthService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);
  private router = inject(Router);

  constructor(
    @Inject(PRODUCT_REPOSITORY) private productRepository: ProductRepository
  ) {}

  ngOnInit() {
    this.loadCategories();
    this.authService.currentProfile$.subscribe(profile => {
      this.userProfile = profile;
    });
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

  signOut() {
    this.authService.signOut().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }
}
