import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { SupabaseClientService } from '../../core/database/supabase.client';
import { Profile } from '../../core/models/profile.model';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  standalone: false
})
export class ProfileComponent implements OnInit, OnDestroy {
  profile: Profile | null = null;
  email = '';
  ordersCount = 0;
  favoritesCount = 0;
  reviewsCount = 0;
  loadingStats = false;
  updatingRole = false;

  private subscription = new Subscription();
  private authService = inject(AuthService);
  private supabaseService = inject(SupabaseClientService);
  private router = inject(Router);
  private alertCtrl = inject(AlertController);
  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);

  get initials(): string {
    const parts = (this.profile?.full_name || 'UCV')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  get roleLabel(): string {
    if (this.profile?.role === 'emprendedor') return 'Emprendedor';
    if (this.profile?.role === 'admin') return 'Administrador';
    return 'Comprador';
  }

  ngOnInit() {
    this.subscription.add(
      this.authService.currentProfile$.subscribe(profile => {
        this.profile = profile;
        if (profile) this.loadProfileSummary(profile);
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  private async loadProfileSummary(profile: Profile) {
    this.loadingStats = true;

    try {
      const reviewColumn = profile.role === 'emprendedor' ? 'reviewee_id' : 'reviewer_id';
      const [userResponse, ordersResponse, favoritesResponse, reviewsResponse] = await Promise.all([
        this.supabaseService.client.auth.getUser(),
        this.supabaseService.client.from('orders').select('id', { count: 'exact', head: true }).eq('buyer_id', profile.id),
        this.supabaseService.client.from('favorites').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
        this.supabaseService.client.from('reviews').select('id', { count: 'exact', head: true }).eq(reviewColumn, profile.id)
      ]);

      this.email = userResponse.data.user?.email || '';
      this.ordersCount = ordersResponse.count || 0;
      this.favoritesCount = favoritesResponse.count || 0;
      this.reviewsCount = reviewsResponse.count || 0;
    } catch (error) {
      console.error('No se pudo cargar el resumen del perfil:', error);
    } finally {
      this.loadingStats = false;
    }
  }

  goToCatalog() {
    this.router.navigate(['/catalog']);
  }

  goToOrders() {
    this.router.navigate(['/orders']);
  }

  openSellerSection() {
    if (this.profile?.role === 'emprendedor') {
      this.router.navigate(['/seller']);
      return;
    }

    this.confirmSellerActivation();
  }

  private async confirmSellerActivation() {
    const alert = await this.alertCtrl.create({
      header: 'Activar modo emprendedor',
      message: 'Tu cuenta podrá publicar productos y gestionar ventas en UCV Market.',
      buttons: [
        { text: 'Ahora no', role: 'cancel' },
        {
          text: 'Activar',
          handler: () => this.activateSellerMode()
        }
      ],
      cssClass: 'custom-alert'
    });

    await alert.present();
  }

  private activateSellerMode() {
    if (this.updatingRole) return;

    this.updatingRole = true;
    this.authService.updateProfile({ role: 'emprendedor' }).subscribe({
      next: () => {
        this.updatingRole = false;
        this.router.navigate(['/seller']);
      },
      error: async (error) => {
        this.updatingRole = false;
        const toast = await this.toastCtrl.create({
          message: error.message || 'No se pudo activar el modo emprendedor.',
          duration: 2200,
          color: 'danger',
          position: 'bottom'
        });
        await toast.present();
      }
    });
  }

  async showPendingSection(section: string) {
    const toast = await this.toastCtrl.create({
      message: `${section} estará disponible próximamente.`,
      duration: 1800,
      color: 'medium',
      position: 'bottom'
    });
    await toast.present();
  }

  async confirmSignOut() {
    const alert = await this.alertCtrl.create({
      header: '¿Cerrar sesión?',
      subHeader: 'UCV Market',
      message: 'Tendrás que ingresar nuevamente para acceder a tu cuenta.',
      buttons: [
        { text: 'Cancelar', role: 'cancel', cssClass: 'market-signout-cancel' },
        {
          text: 'Cerrar sesión',
          role: 'destructive',
          cssClass: 'market-signout-confirm',
          handler: () => {
            void this.signOut();
          }
        }
      ],
      cssClass: ['custom-alert', 'market-signout-alert']
    });

    await alert.present();
  }

  private async signOut() {
    const loading = await this.loadingCtrl.create({
      message: 'Cerrando sesión...',
      spinner: 'crescent',
      cssClass: ['market-login-loading', 'market-logout-loading']
    });

    await loading.present();

    this.authService.signOut().subscribe({
      next: async () => {
        await loading.dismiss();
        await this.router.navigate(['/login']);
      },
      error: async (error) => {
        await loading.dismiss();

        const toast = await this.toastCtrl.create({
          message: error.message || 'No se pudo cerrar la sesión.',
          duration: 2200,
          color: 'danger',
          position: 'bottom'
        });

        await toast.present();
      }
    });
  }
}
