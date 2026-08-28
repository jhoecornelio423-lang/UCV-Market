import { Component, inject, OnInit, NgZone } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { NotificationService } from './core/services/notification.service';
import { filter } from 'rxjs/operators';
import { Profile } from './core/models/profile.model';
import { isBuyerPrimaryRoute, normalizeAppPath } from './core/navigation/buyer-navigation';
import { isSellerPrimaryRoute } from './core/navigation/seller-navigation';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private zone = inject(NgZone);
  private notificationService = inject(NotificationService);

  userProfile: Profile | null = null;
  showSidebar = false;
  currentPath = '';

  ngOnInit() {
    // Pedir permiso de notificaciones apenas se abre la app (Android 13+)
    this.notificationService.requestPermission();

    // 1. Escuchar perfil del usuario para saber el ROL
    this.authService.currentProfile$.subscribe(profile => {
      this.userProfile = profile;
      this.updateSidebarVisibility();
    });

    // 2. Escuchar la RUTA actual para saber si mostrar el Sidebar (Ocultar en Login/Registro)
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentPath = event.urlAfterRedirects;
      this.updateSidebarVisibility();
    });
  }

  private updateSidebarVisibility() {
    const path = normalizeAppPath(this.currentPath || this.router.url);
    const hiddenRoutes = ['/login', '/admin'];
    const isHiddenRoute = hiddenRoutes.some(route => path.startsWith(route));

    if (!this.userProfile || this.userProfile.role === 'admin' || isHiddenRoute) {
      this.showSidebar = false;
      return;
    }

    if (this.userProfile.role === 'comprador') {
      this.showSidebar = isBuyerPrimaryRoute(path);
      return;
    }

    this.showSidebar = this.userProfile.role === 'emprendedor' && isSellerPrimaryRoute(path);
  }

  // Métodos de navegación globales
  goTo(path: string, queryParams: any = {}) {
    this.router.navigate([path], { queryParams });
  }

  signOut() {
    this.authService.signOut().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }
}
