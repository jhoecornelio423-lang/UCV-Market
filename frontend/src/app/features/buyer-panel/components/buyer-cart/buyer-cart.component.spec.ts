import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { of } from 'rxjs';

import { TEST_PROVIDERS } from 'src/testing/test-providers';
import { CartService } from '../../../../core/cart/cart.service';
import { BuyerCartComponent } from './buyer-cart.component';
import { Product } from '../../../../core/models/product.model';

describe('BuyerCartComponent', () => {
  let component: BuyerCartComponent;
  let fixture: ComponentFixture<BuyerCartComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [BuyerCartComponent],
      imports: [IonicModule.forRoot()],
      providers: [
        TEST_PROVIDERS,
        {
          provide: CartService,
          useValue: {
            cartItems$: of([]),
            getCartTotal$: () => of(0),
            getCartCount$: () => of(0),
            updateQuantity: () => true,
            removeFromCart: () => undefined,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BuyerCartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('uses the singular product label for one cart item', () => {
    component.cartCount = 1;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.item-count').textContent.trim()).toBe('(1 producto)');
  });

  it('uses the plural product label for multiple cart items', () => {
    component.cartCount = 2;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.item-count').textContent.trim()).toBe('(2 productos)');
  });

  it('names back, remove and quantity controls in Spanish', () => {
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
    component.cartItems = [{ product, quantity: 1 }];
    fixture.detectChanges();

    const controls = fixture.nativeElement.querySelectorAll('[aria-label]') as NodeListOf<Element>;
    const labels = Array.from(controls).map(element => element.getAttribute('aria-label'));
    expect(labels).toContain('Volver al catálogo');
    expect(labels).toContain('Eliminar Brownie de chocolate del carrito');
    expect(labels).toContain('Disminuir cantidad de Brownie de chocolate');
    expect(labels).toContain('Aumentar cantidad de Brownie de chocolate');
  });
});
