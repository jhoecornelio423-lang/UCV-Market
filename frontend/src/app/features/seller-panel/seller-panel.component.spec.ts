import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';

import { SellerPanelComponent } from './seller-panel.component';

describe('SellerPanelComponent navigation shell', () => {
  let router: { url: string };
  let component: SellerPanelComponent;

  beforeEach(() => {
    router = { url: '/seller/dashboard', navigate: jasmine.createSpy('navigate') } as any;
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: { signOut: () => of(void 0) } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new SellerPanelComponent());
  });

  it('shows bottom navigation only on seller primary routes', () => {
    for (const path of ['/seller/dashboard', '/seller/orders?tab=nuevos', '/seller/business/']) {
      router.url = path;
      expect(component.showPrimaryNavigation).withContext(path).toBeTrue();
    }

    for (const path of ['/seller/product-form', '/seller/notifications', '/seller/support']) {
      router.url = path;
      expect(component.showPrimaryNavigation).withContext(path).toBeFalse();
    }
  });

  it('configures the five seller drawer destinations', () => {
    expect(component.navigationConfig.items.map(item => item.route)).toEqual([
      '/seller/dashboard',
      '/seller/orders',
      '/seller/products',
      '/seller/stats',
      '/seller/business',
    ]);
  });
});
