import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, Subject, of } from 'rxjs';

import { AppComponent } from './app.component';
import { AuthService } from './core/auth/auth.service';
import { Profile } from './core/models/profile.model';
import { NotificationService } from './core/services/notification.service';

describe('AppComponent navigation shell', () => {
  const buyer: Profile = {
    id: 'buyer-1',
    full_name: 'Comprador UCV',
    phone: '999999999',
    role: 'comprador',
    rating_average: 0,
    campus: 'Lima Norte',
  };
  const seller: Profile = { ...buyer, id: 'seller-1', role: 'emprendedor' };

  let profile$: BehaviorSubject<Profile | null>;
  let routerEvents: Subject<NavigationEnd>;
  let routerStub: { url: string; events: Subject<NavigationEnd>; navigate: jasmine.Spy };
  let component: AppComponent;

  beforeEach(async () => {
    profile$ = new BehaviorSubject<Profile | null>(null);
    routerEvents = new Subject<NavigationEnd>();
    routerStub = {
      url: '/',
      events: routerEvents,
      navigate: jasmine.createSpy('navigate').and.resolveTo(true),
    };

    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      providers: [
        { provide: Router, useValue: routerStub },
        {
          provide: AuthService,
          useValue: { currentProfile$: profile$.asObservable(), signOut: () => of(undefined) },
        },
        {
          provide: NotificationService,
          useValue: { requestPermission: jasmine.createSpy('requestPermission') },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function navigateTo(path: string): void {
    routerStub.url = path;
    routerEvents.next(new NavigationEnd(1, path, path));
  }

  it('shows the desktop sidebar on every primary buyer route', () => {
    profile$.next(buyer);

    for (const path of [
      '/buyer-panel/catalog',
      '/buyer-panel/explore',
      '/buyer-panel/orders',
      '/buyer-panel/favorites',
      '/buyer-panel/profile',
    ]) {
      navigateTo(path);
      expect(component.showSidebar).withContext(path).toBeTrue();
    }
  });

  it('hides the desktop sidebar on buyer detail and transaction routes', () => {
    profile$.next(buyer);

    for (const path of [
      '/buyer-panel/product/product-1',
      '/buyer-panel/cart',
      '/buyer-panel/checkout',
    ]) {
      navigateTo(path);
      expect(component.showSidebar).withContext(path).toBeFalse();
    }
  });

  it('preserves the seller sidebar outside hidden routes', () => {
    profile$.next(seller);
    navigateTo('/seller/dashboard');

    expect(component.showSidebar).toBeTrue();
  });
});
