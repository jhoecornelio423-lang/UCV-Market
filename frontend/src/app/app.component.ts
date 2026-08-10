import { Component, inject, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { filter } from 'rxjs/operators';
import { Profile } from './core/models/profile.model';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  userProfile: Profile | null = null;
  showSidebar = false;
  currentPath = '';

  ngOnInit() {
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
}
