import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { BuyerExploreComponent } from './buyer-explore.component';
import { of } from 'rxjs';
import { Profile } from '../../../../core/models/profile.model';
import { AUTH_REPOSITORY } from '../../../../core/repositories/auth.repository';
import { SupabaseClientService } from '../../../../core/database/supabase.client';
import { RouterModule } from '@angular/router';
import { PRODUCT_REPOSITORY } from '../../../../core/repositories/product.repository';
import { FavoritesService } from '../../../../core/services/favorites.service';
import { Product } from '../../../../core/models/product.model';

describe('BuyerExploreComponent', () => {
  let component: BuyerExploreComponent;
  let fixture: ComponentFixture<BuyerExploreComponent>;

  beforeEach(waitForAsync(() => {
    const realtimeChannel: any = {};
    realtimeChannel.on = jasmine.createSpy('on').and.returnValue(realtimeChannel);
    realtimeChannel.subscribe = jasmine.createSpy('subscribe').and.returnValue(realtimeChannel);

    TestBed.configureTestingModule({
      declarations: [ BuyerExploreComponent ],
      imports: [IonicModule.forRoot(), RouterModule.forRoot([])],
      providers: [
        { provide: AUTH_REPOSITORY, useValue: { getSellers: () => of([]) } },
        {
          provide: PRODUCT_REPOSITORY,
          useValue: { getCategories: () => of([]), getActiveProducts: () => of([]) },
        },
        {
          provide: FavoritesService,
          useValue: { isFavorite: () => false, toggleFavorite: () => Promise.resolve() },
        },
        {
          provide: SupabaseClientService,
          useValue: {
            client: {
              channel: () => realtimeChannel,
              removeChannel: () => undefined,
            },
          },
        },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BuyerExploreComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('hides the complete seller section when there are no sellers', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('EMPRENDIMIENTOS');
    expect(fixture.nativeElement.querySelector('.sellers-scroll')).toBeNull();
  });

  it('shows the seller section when at least one seller is available', () => {
    const seller: Profile = {
      id: 'seller-1',
      full_name: 'Postres UCV',
      phone: '999999999',
      role: 'emprendedor',
      rating_average: 4.8,
      campus: 'Lima Norte',
    };
    fixture.detectChanges();
    component.sellers = [seller];

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('EMPRENDIMIENTOS');
    expect(fixture.nativeElement.textContent).toContain('Postres UCV');
  });

  it('names filter and favorite icon controls in Spanish', () => {
    const product: Product = {
      id: 'product-1',
      seller_id: 'seller-1',
      category_id: 'category-1',
      name: 'Brownie de chocolate',
      description: 'Brownie artesanal',
      price: 5,
      stock: 4,
      is_active: true,
      pickup_location: 'Campus UCV',
    };
    fixture.detectChanges();
    component.filteredProducts$ = of([product]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.filter-btn').getAttribute('aria-label'))
      .toBe('Abrir filtros');
    expect(fixture.nativeElement.querySelector('.favorite-btn').getAttribute('aria-label'))
      .toBe('Agregar Brownie de chocolate a favoritos');
  });

  it('uses the singular result label for one product', () => {
    const product: Product = {
      id: 'product-1',
      seller_id: 'seller-1',
      category_id: 'category-1',
      name: 'Brownie de chocolate',
      description: 'Brownie artesanal',
      price: 5,
      stock: 4,
      is_active: true,
      pickup_location: 'Campus UCV',
    };
    fixture.detectChanges();
    component.filteredProducts$ = of([product]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.results-count').textContent.trim())
      .toBe('1 resultado');
    expect(fixture.nativeElement.querySelector('.product-image img').getAttribute('alt'))
      .toBe('Brownie de chocolate');
  });
});
