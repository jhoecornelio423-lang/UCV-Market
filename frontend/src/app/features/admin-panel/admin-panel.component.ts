import { Component, OnInit, inject, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController, LoadingController } from '@ionic/angular';

import { PRODUCT_REPOSITORY, ProductRepository } from '../../core/repositories/product.repository';
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

  constructor(
    @Inject(PRODUCT_REPOSITORY) private productRepository: ProductRepository
  ) {}

  get initials(): string {
    const name = this.userProfile?.full_name || 'Admin';
    return name.substring(0, 2).toUpperCase();
  }

  pendingApplicationsCount = 0;
  openTicketsCount = 0;
  activeReportsCount = 0;

  ngOnInit() {
    this.authService.currentProfile$.subscribe(profile => {
      this.userProfile = profile;
    });
    this.loadBadges();
  }

  loadBadges() {
    this.adminRepo.getPendingApplications().subscribe(apps => {
      this.pendingApplicationsCount = apps.length;
    });
    this.adminRepo.getSupportTickets().subscribe(tickets => {
      this.openTicketsCount = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
    });
    this.adminRepo.getReportedProducts().subscribe(reports => {
      this.activeReportsCount = reports.length;
    });
  }

  signOut() {
    this.authService.signOut().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }
}
