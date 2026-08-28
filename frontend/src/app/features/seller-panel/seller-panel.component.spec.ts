import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { SellerPanelComponent } from './seller-panel.component';

describe('SellerPanelComponent navigation shell', () => {
  let router: { url: string };
  let component: SellerPanelComponent;

  beforeEach(() => {
    router = { url: '/seller/dashboard' };
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: router }],
    });
    component = TestBed.runInInjectionContext(() => new SellerPanelComponent());
  });

  it('shows bottom navigation only on seller primary routes', () => {
    for (const path of ['/seller/dashboard', '/seller/orders?tab=nuevos', '/seller/business/']) {
      router.url = path;
      expect(component.showBottomNav).withContext(path).toBeTrue();
    }

    for (const path of ['/seller/product-form', '/seller/notifications', '/seller/support']) {
      router.url = path;
      expect(component.showBottomNav).withContext(path).toBeFalse();
    }
  });
});
