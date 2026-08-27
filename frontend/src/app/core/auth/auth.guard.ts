import { Injectable, inject } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, take, filter, timeout, catchError } from 'rxjs/operators';
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
      map(() => {
        const profile = this.authService.currentProfileValue;

        if (!profile || profile.role === 'suspended' || profile.role === 'suspended_buyer') {
          return this.router.createUrlTree(['/login']);
        }

        const expectedRoles: string[] = route.data['expectedRoles'];
        if (expectedRoles?.length && !expectedRoles.includes(profile.role)) {
          return this.router.createUrlTree(['/buyer-panel']);
        }

        return true;
      }),
      timeout({ first: 4000 }),
      catchError(() => of(this.router.createUrlTree(['/login'])))
    );
  }
}
