import { Injectable, inject } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take, filter, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private authService = inject(AuthService);
  private router = inject(Router);

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    // Esperar a que AuthService haya evaluado la sesión inicial
    return this.authService.isInitialized$.pipe(
      filter(initialized => initialized),
      take(1),
      switchMap(() => this.authService.currentProfile$.pipe(take(1))),
      map(profile => {
        if (!profile) {
          // No hay sesión, redirige al login
          return this.router.createUrlTree(['/login']);
        }
        const expectedRoles: string[] = route.data['expectedRoles'];
        if (expectedRoles && expectedRoles.length > 0) {
          const hasRole = expectedRoles.includes(profile.role);
          if (!hasRole) {
            // El usuario no tiene el rol necesario, redirige al catálogo
            return this.router.createUrlTree(['/buyer-panel']);
          }
        }
        return true;
      })
    );
  }
}
