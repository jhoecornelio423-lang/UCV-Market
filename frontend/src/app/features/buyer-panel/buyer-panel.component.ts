import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isBuyerPrimaryRoute } from '../../core/navigation/buyer-navigation';
import { AuthService } from '../../core/auth/auth.service';
import { RoleMobileNavigationConfig } from '../../shared/components/role-mobile-navigation/role-mobile-navigation.model';

@Component({
  selector: 'app-buyer-panel',
  templateUrl: './buyer-panel.component.html',
  styleUrls: ['./buyer-panel.component.scss'],
  standalone: false
})
export class BuyerPanelComponent implements OnInit {
  currentPath = '';
  readonly navigationConfig: RoleMobileNavigationConfig = {
    menuId: 'buyer-primary-menu',
    roleLabel: 'Comprador',
    ariaLabel: 'Navegación del comprador',
    items: [
      { label: 'Inicio', route: '/buyer-panel/catalog', icon: 'home-outline' },
      { label: 'Explorar', route: '/buyer-panel/explore', icon: 'compass-outline' },
      { label: 'Pedidos', route: '/buyer-panel/orders', icon: 'receipt-outline' },
      { label: 'Favoritos', route: '/buyer-panel/favorites', icon: 'heart-outline' },
      { label: 'Perfil', route: '/buyer-panel/profile', icon: 'person-outline' },
    ],
  };

  private router = inject(Router);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((event: any) => {
      this.currentPath = event.urlAfterRedirects;
    });
  }

  ngOnInit() {
    this.currentPath = this.router.url;
  }

  get showPrimaryNavigation(): boolean {
    return isBuyerPrimaryRoute(this.currentPath);
  }

  signOut(): void {
    this.authService.signOut().subscribe(() => this.router.navigate(['/login']));
  }
}
