import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { SupabaseClientService } from '../../../../core/database/supabase.client';
import { Profile } from '../../../../core/models/profile.model';
import { FavoritesService } from '../../../../core/services/favorites.service';
import { SellerApplicationRepository } from '../../../../core/repositories/seller-application.repository';

@Component({
  selector: 'app-buyer-profile',
  templateUrl: './buyer-profile.component.html',
  styleUrls: ['./buyer-profile.component.scss'],
  standalone: false
})
export class BuyerProfileComponent implements OnInit, OnDestroy {
  profile: Profile | null = null;
  email = '';
  ordersCount = 0;
  favoritesCount = 0;
  reviewsCount = 0;
  loadingStats = false;
  updatingRole = false;
  hasPendingApplication = false;

  private subscription = new Subscription();
  private authService = inject(AuthService);
  private supabaseService = inject(SupabaseClientService);
  private router = inject(Router);
  private alertCtrl = inject(AlertController);
  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);
  private favoritesService = inject(FavoritesService);
  private applicationRepo = inject(SellerApplicationRepository);

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
    this.subscription.add(
      this.favoritesService.favorites$.subscribe(favs => {
        this.favoritesCount = favs.length;
      })
    );
    this.subscription.add(
      this.authService.currentProfile$.subscribe(profile => {
        if (profile) {
          this.applicationRepo.getUserApplication(profile.id).subscribe(app => {
            if (app && app.status === 'pending') {
              this.hasPendingApplication = true;
            } else {
              this.hasPendingApplication = false;
            }
          });
        }
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
      const [userResponse, ordersResponse, reviewsResponse] = await Promise.all([
        this.supabaseService.client.auth.getUser(),
        this.supabaseService.client.from('orders').select('id', { count: 'exact', head: true }).eq('buyer_id', profile.id),
        this.supabaseService.client.from('reviews').select('id', { count: 'exact', head: true }).eq(reviewColumn, profile.id)
      ]);

      this.email = userResponse.data.user?.email || '';
      this.ordersCount = ordersResponse.count || 0;
      this.reviewsCount = reviewsResponse.count || 0;
    } catch (error) {
      console.error('No se pudo cargar el resumen del perfil:', error);
    } finally {
      this.loadingStats = false;
    }
  }

  goToCatalog() {
    this.router.navigate(['/buyer-panel/catalog']);
  }

  goToOrders() {
    this.router.navigate(['/buyer-panel/orders']);
  }

  openSellerSection() {
    if (this.profile?.role === 'emprendedor') {
      this.router.navigate(['/seller']);
      return;
    }

    if (this.hasPendingApplication) {
      this.showToast('Tu solicitud está siendo revisada por un administrador.', 'medium');
      return;
    }

    this.router.navigate(['/buyer-panel/seller-application']);
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  // Legacy method removed

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
