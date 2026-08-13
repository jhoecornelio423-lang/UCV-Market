import { Injectable, inject } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { Observable, of, from } from 'rxjs';
import { map, take, filter, switchMap, timeout, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { Profile } from '../models/profile.model';

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
      switchMap(() => from(this.authService.hasActiveSession())),
      switchMap(hasSession => {
        if (!hasSession) {
          // No hay sesión, redirige al login
          return of(this.router.createUrlTree(['/login']));
        }
        // Hay sesión: usar el perfil ya cargado o esperarlo un instante.
        // Evita la carrera justo tras iniciar sesión (el perfil llega a
        // currentProfile$ unos milisegundos después del login).
        const cached = this.authService.currentProfileValue;
        const profile$ = cached
          ? of(cached)
          : this.authService.currentProfile$.pipe(
              filter((profile): profile is Profile => profile !== null),
              take(1)
            );
        return profile$.pipe(
          map(profile => {
            // Usuarios suspendidos no pueden acceder a ningún panel
            if (profile.role === 'suspended' || profile.role === 'suspended_buyer') {
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
          }),
          timeout({ first: 4000, each: 0 }),
          catchError(() => of(this.router.createUrlTree(['/login'])))
        );
      })
    );
  }
}
