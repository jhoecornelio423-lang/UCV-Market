import { Component, inject, OnInit, NgZone } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { filter } from 'rxjs/operators';
import { Profile } from './core/models/profile.model';
import { App, URLOpenListenerEvent } from '@capacitor/app';

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

  userProfile: Profile | null = null;
  showSidebar = false;
  currentPath = '';

  ngOnInit() {
    this.setupDeepLinks();
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
    const hiddenRoutes = ['/login', '/register', '/welcome'];
    const isHiddenRoute = hiddenRoutes.some(route => this.currentPath.startsWith(route));
    this.showSidebar = !!this.userProfile && !isHiddenRoute;
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

  private setupDeepLinks() {
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      this.zone.run(() => {
        console.log('App opened with URL:', event.url);
        const urlStr = event.url;
        
        // Buscamos si tiene el token o el code
        if (urlStr.includes('access_token=') || urlStr.includes('code=')) {
          // Extraemos la parte después del esquema (login-callback...)
          const parts = urlStr.split('://login-callback');
          if (parts.length > 1) {
            const redirectPath = '/buyer-panel' + parts[1];
            console.log('Navegando internamente a:', redirectPath);
            this.router.navigateByUrl(redirectPath);
          }
        }
      });
    });
  }
}
