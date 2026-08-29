import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { of } from 'rxjs';

import { BuyerPanelComponent } from './buyer-panel.component';
import { RoleMobileNavigationComponent } from '../../shared/components/role-mobile-navigation/role-mobile-navigation.component';
import { AuthService } from '../../core/auth/auth.service';

describe('BuyerPanelComponent', () => {
  let component: BuyerPanelComponent;
  let fixture: ComponentFixture<BuyerPanelComponent>;

  beforeEach(waitForAsync(() => {
    const content = document.createElement('div');
    content.id = 'buyer-primary-content';
    document.body.appendChild(content);
    TestBed.configureTestingModule({
      declarations: [ BuyerPanelComponent ],
      imports: [IonicModule.forRoot(), RouterModule.forRoot([]), RoleMobileNavigationComponent],
      providers: [{ provide: AuthService, useValue: { signOut: () => of(void 0) } }]
    }).compileComponents();

    fixture = TestBed.createComponent(BuyerPanelComponent);
    component = fixture.componentInstance;
  }));

  afterEach(() => document.querySelector('body > #buyer-primary-content')?.remove());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('configures the five drawer destinations', () => {
    fixture.detectChanges();
    component.currentPath = '/buyer-panel/catalog';
    fixture.detectChanges();
    const destinations = component.navigationConfig.items.map(item => item.route);

    expect(destinations).toEqual([
      '/buyer-panel/catalog',
      '/buyer-panel/explore',
      '/buyer-panel/orders',
      '/buyer-panel/favorites',
      '/buyer-panel/profile',
    ]);
  });

  it('shows the mobile drawer only on the five primary buyer routes', () => {
    fixture.detectChanges();

    for (const path of [
      '/buyer-panel/catalog',
      '/buyer-panel/explore',
      '/buyer-panel/orders',
      '/buyer-panel/favorites',
      '/buyer-panel/profile',
    ]) {
      component.currentPath = path;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-role-mobile-navigation'))
        .withContext(path)
        .not.toBeNull();
    }

    for (const path of [
      '/buyer-panel/product/product-1',
      '/buyer-panel/cart',
      '/buyer-panel/checkout',
      '/buyer-panel/tracking/order-1',
      '/buyer-panel/seller-application',
      '/buyer-panel/support',
    ]) {
      component.currentPath = path;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-role-mobile-navigation'))
        .withContext(path)
        .toBeNull();
    }
  });
});
