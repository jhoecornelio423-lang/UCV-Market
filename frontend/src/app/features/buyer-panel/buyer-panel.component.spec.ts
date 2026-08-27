import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { By } from '@angular/platform-browser';
import { Router, RouterLink, RouterModule } from '@angular/router';

import { BuyerPanelComponent } from './buyer-panel.component';

describe('BuyerPanelComponent', () => {
  let component: BuyerPanelComponent;
  let fixture: ComponentFixture<BuyerPanelComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ BuyerPanelComponent ],
      imports: [IonicModule.forRoot(), RouterModule.forRoot([])]
    }).compileComponents();

    fixture = TestBed.createComponent(BuyerPanelComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('links the five bottom navigation actions to their exact destinations', () => {
    fixture.detectChanges();
    component.currentPath = '/buyer-panel/catalog';
    fixture.detectChanges();
    const router = TestBed.inject(Router);

    const destinations = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map(element => element.injector.get(RouterLink).urlTree)
      .map(urlTree => router.serializeUrl(urlTree!));

    expect(destinations).toEqual([
      '/buyer-panel/catalog',
      '/buyer-panel/explore',
      '/buyer-panel/orders',
      '/buyer-panel/favorites',
      '/buyer-panel/profile',
    ]);
  });

  it('shows bottom navigation only on the five primary buyer routes', () => {
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
      expect(fixture.nativeElement.querySelector('.bottom-navigation-figma'))
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
      expect(fixture.nativeElement.querySelector('.bottom-navigation-figma'))
        .withContext(path)
        .toBeNull();
    }
  });
});
