import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AppRoutingModule } from './app-routing.module';

describe('AppRoutingModule role boundaries', () => {
  it('restricts the buyer panel to comprador profiles', () => {
    TestBed.configureTestingModule({ imports: [AppRoutingModule] });
    const router = TestBed.inject(Router);

    const buyerRoute = router.config.find(route => route.path === 'buyer-panel');

    expect(buyerRoute?.data?.['expectedRoles']).toEqual(['comprador']);
  });
});
