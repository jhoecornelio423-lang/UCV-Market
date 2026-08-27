import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { BuyerProductDetailComponent } from './buyer-product-detail.component';
import { Product } from '../../../../core/models/product.model';
import { RouterModule } from '@angular/router';
import { of } from 'rxjs';
import { PRODUCT_REPOSITORY } from '../../../../core/repositories/product.repository';
import { CartService } from '../../../../core/cart/cart.service';
import { FavoritesService } from '../../../../core/services/favorites.service';
import { AuthService } from '../../../../core/auth/auth.service';

describe('BuyerProductDetailComponent', () => {
  let component: BuyerProductDetailComponent;
  let fixture: ComponentFixture<BuyerProductDetailComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ BuyerProductDetailComponent ],
      imports: [IonicModule.forRoot(), RouterModule.forRoot([])],
      providers: [
        { provide: PRODUCT_REPOSITORY, useValue: { getProductById: () => of(null) } },
        { provide: CartService, useValue: { addToCart: () => true } },
        {
          provide: FavoritesService,
          useValue: { isFavorite: () => false, toggleFavorite: () => Promise.resolve() },
        },
        { provide: AuthService, useValue: { isAuthenticated: () => true } },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BuyerProductDetailComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('gives every icon-only product control a Spanish accessible name', () => {
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
      seller: {
        id: 'seller-1',
        full_name: 'Postres UCV',
        phone: '999999999',
        role: 'emprendedor',
        rating_average: 4.8,
        campus: 'Lima Norte',
      },
    };
    component.product = product;
    component.loading = false;

    fixture.detectChanges();

    const controls = fixture.nativeElement.querySelectorAll('button[aria-label]') as NodeListOf<Element>;
    const labels = Array.from(controls).map(button => button.getAttribute('aria-label'));
    expect(labels).toContain('Volver al catálogo');
    expect(labels).toContain('Agregar a favoritos');
    expect(labels).toContain('Abrir carrito');
    expect(labels).toContain('Disminuir cantidad');
    expect(labels).toContain('Aumentar cantidad');
    expect(fixture.nativeElement.querySelector('.image-header img').getAttribute('alt'))
      .toBe('Brownie de chocolate');
    expect(fixture.nativeElement.querySelector('.stat-label').textContent.trim())
      .toBe('Calificación');
  });
});
