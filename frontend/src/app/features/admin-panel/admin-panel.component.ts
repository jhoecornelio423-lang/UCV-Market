import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AlertController, ToastController, LoadingController } from '@ionic/angular';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PRODUCT_REPOSITORY } from '../../core/repositories/product.repository';
import { AuthService } from '../../core/auth/auth.service';
import { Category } from '../../core/models/category.model';
import { Profile } from '../../core/models/profile.model';
import { AdminRepository } from '../../core/repositories/admin.repository';

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
  private adminRepo = inject(AdminRepository);
  private productRepository = inject(PRODUCT_REPOSITORY);
  private destroyRef = inject(DestroyRef);

  get initials(): string {
    const name = this.userProfile?.full_name || 'Admin';
    return name.substring(0, 2).toUpperCase();
  }

  pendingApplicationsCount = 0;
  openTicketsCount = 0;
  activeReportsCount = 0;

  ngOnInit() {
    this.authService.currentProfile$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(profile => {
      this.userProfile = profile;
    });
    this.loadBadges();

    // Refrescar las insignias al navegar entre secciones (reportes resueltos, solicitudes atendidas, etc.)
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.loadBadges();
    });
  }

  loadBadges() {
    this.adminRepo.getPendingApplications().subscribe({
      next: apps => {
        this.pendingApplicationsCount = apps.length;
      },
      error: (err) => {
        console.error('Error al cargar solicitudes pendientes:', err);
      }
    });
    this.adminRepo.getSupportTickets().subscribe({
      next: tickets => {
        this.openTicketsCount = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
      },
      error: (err) => {
        console.error('Error al cargar tickets de soporte:', err);
      }
    });
    this.adminRepo.getReportedProducts().subscribe({
      next: reports => {
        // Solo reportes pendientes de moderación cuentan como activos
        this.activeReportsCount = reports.filter((r: any) => !r.status || r.status === 'pending').length;
      },
      error: (err) => {
        console.error('Error al cargar reportes de productos:', err);
      }
    });
  }

  signOut() {
    this.authService.signOut().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (err) => {
        console.error('Error al cerrar sesión:', err);
      }
    });
  }
}
