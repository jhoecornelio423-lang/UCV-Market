import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { isSellerPrimaryRoute } from '../../core/navigation/seller-navigation';
import { AuthService } from '../../core/auth/auth.service';
import { RoleMobileNavigationConfig } from '../../shared/components/role-mobile-navigation/role-mobile-navigation.model';

@Component({
  selector: 'app-seller-panel',
  templateUrl: './seller-panel.component.html',
  styleUrls: ['./seller-panel.component.scss'],
  standalone: false
})
export class SellerPanelComponent {
  private router = inject(Router);
  private authService = inject(AuthService);

  readonly navigationConfig: RoleMobileNavigationConfig = {
    menuId: 'seller-primary-menu',
    roleLabel: 'Vendedor',
    ariaLabel: 'Navegación del vendedor',
    items: [
      { label: 'Dashboard', route: '/seller/dashboard', icon: 'stats-chart-outline' },
      { label: 'Pedidos', route: '/seller/orders', icon: 'bag-handle-outline' },
      { label: 'Productos', route: '/seller/products', icon: 'pricetag-outline' },
      { label: 'Estadísticas', route: '/seller/stats', icon: 'trending-up-outline' },
      { label: 'Negocio', route: '/seller/business', icon: 'business-outline' },
    ],
  };

  get currentPath(): string {
    return this.router.url;
  }

  get showPrimaryNavigation(): boolean {
    return isSellerPrimaryRoute(this.router.url);
  }

  signOut(): void {
    this.authService.signOut().subscribe(() => this.router.navigate(['/login']));
  }
}
