import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

import { Profile } from '../models/profile.model';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

class AuthServiceStub {
  readonly initialized = new BehaviorSubject(false);
  readonly profile = new BehaviorSubject<Profile | null>(null);
  readonly isInitialized$ = this.initialized.asObservable();
  readonly currentProfile$ = this.profile.asObservable();

  get currentProfileValue(): Profile | null {
    return this.profile.value;
  }
}

describe('AuthGuard', () => {
  const buyer: Profile = {
    id: 'buyer-1',
    full_name: 'Comprador UCV',
    phone: '999999999',
    role: 'comprador',
    rating_average: 0,
    campus: 'Lima Norte',
  };
  const seller: Profile = { ...buyer, id: 'seller-1', role: 'emprendedor' };
  const suspended: Profile = { ...buyer, role: 'suspended_buyer' };

  let guard: AuthGuard;
  let auth: AuthServiceStub;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        { provide: AuthService, useClass: AuthServiceStub },
        provideRouter([]),
      ],
    });

    guard = TestBed.inject(AuthGuard);
    auth = TestBed.inject(AuthService) as unknown as AuthServiceStub;
    router = TestBed.inject(Router);
  });

  function routeFor(...roles: string[]): ActivatedRouteSnapshot {
    return { data: { expectedRoles: roles } } as unknown as ActivatedRouteSnapshot;
  }

  const state = { url: '/buyer-panel/catalog' } as RouterStateSnapshot;

  it('keeps an authorized buyer on a protected route after initialization', async () => {
    auth.profile.next(buyer);
    auth.initialized.next(true);

    const result = await firstValueFrom(guard.canActivate(routeFor('comprador'), state));

    expect(result).toBeTrue();
  });

  it('redirects a visitor without a profile to login', async () => {
    auth.initialized.next(true);

    const result = await firstValueFrom(guard.canActivate(routeFor('comprador'), state));

    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('rejects a profile that does not have the expected role', async () => {
    auth.profile.next(seller);
    auth.initialized.next(true);

    const result = await firstValueFrom(guard.canActivate(routeFor('comprador'), state));

    expect(router.serializeUrl(result as UrlTree)).toBe('/buyer-panel');
  });

  it('redirects a suspended buyer to login', async () => {
    auth.profile.next(suspended);
    auth.initialized.next(true);

    const result = await firstValueFrom(guard.canActivate(routeFor('comprador'), state));

    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });
});
