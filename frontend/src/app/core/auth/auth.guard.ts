import { Injectable, inject } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
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
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return this.authService.currentProfile$.pipe(
      take(1),
      map(profile => {
        // 1. Validar si el usuario está autenticado
        if (!profile) {
          // No hay sesión, redirige al login
          return this.router.createUrlTree(['/login']);
        }

        // 2. Validar restricciones de roles (si existen en la ruta)
        const expectedRoles: string[] = route.data['expectedRoles'];
        if (expectedRoles && expectedRoles.length > 0) {
          const hasRole = expectedRoles.includes(profile.role);
          if (!hasRole) {
            // El usuario no tiene el rol necesario, redirige al home
            return this.router.createUrlTree(['/home']);
          }
        }

        return true;
      })
    );
  }
}
