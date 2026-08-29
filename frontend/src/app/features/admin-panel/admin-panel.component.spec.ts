import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AdminPanelComponent } from './admin-panel.component';
import { AuthService } from '../../core/auth/auth.service';
import { AdminRepository } from '../../core/repositories/admin.repository';
import { PRODUCT_REPOSITORY } from '../../core/repositories/product.repository';

describe('AdminPanelComponent navigation shell', () => {
  let router: { url: string; events: ReturnType<typeof of>; navigate: jasmine.Spy };
  let component: AdminPanelComponent;

  beforeEach(() => {
    router = { url: '/admin/dashboard', events: of(), navigate: jasmine.createSpy('navigate') };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: { currentProfile$: of(null), signOut: () => of(void 0) } },
        { provide: AdminRepository, useValue: {} },
        { provide: PRODUCT_REPOSITORY, useValue: {} },
      ],
    });
    component = TestBed.runInInjectionContext(() => new AdminPanelComponent());
  });

  it('shows global navigation only on exact primary admin routes', () => {
    for (const path of ['/admin/dashboard', '/admin/users?state=active', '/admin/reports/']) {
      component.currentPath = path;
      expect(component.showPrimaryNavigation).withContext(path).toBeTrue();
    }
    for (const path of ['/admin', '/admin/users/123', '/seller/dashboard']) {
      component.currentPath = path;
      expect(component.showPrimaryNavigation).withContext(path).toBeFalse();
    }
  });

  it('configures all seven admin destinations with live badges', () => {
    component.pendingApplicationsCount = 3;
    component.openTicketsCount = 2;
    component.activeReportsCount = 1;
    const items = component.navigationConfig.items;

    expect(items.map(item => item.route)).toEqual([
      '/admin/dashboard', '/admin/sellers', '/admin/users', '/admin/products',
      '/admin/categories', '/admin/support', '/admin/reports',
    ]);
    expect(items.find(item => item.route === '/admin/sellers')?.badge).toBe(3);
    expect(items.find(item => item.route === '/admin/support')?.badge).toBe(2);
    expect(items.find(item => item.route === '/admin/reports')?.badge).toBe(1);
  });
});
