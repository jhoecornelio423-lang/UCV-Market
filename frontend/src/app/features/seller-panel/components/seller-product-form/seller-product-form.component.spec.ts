import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { SellerProductFormComponent } from './seller-product-form.component';
import { TEST_PROVIDERS } from 'src/testing/test-providers';
import { FormsModule } from '@angular/forms';

describe('SellerProductFormComponent', () => {
  let component: SellerProductFormComponent;
  let fixture: ComponentFixture<SellerProductFormComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ SellerProductFormComponent ],
      imports: [IonicModule.forRoot(), FormsModule],
      providers: TEST_PROVIDERS
    }).compileComponents();

    fixture = TestBed.createComponent(SellerProductFormComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('associates fields and image upload with accessible labels', () => {
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('label[for="product-name"]')).not.toBeNull();
    expect(root.querySelector('label[for="product-image"]')).not.toBeNull();
    expect(root.querySelector('#product-active')?.getAttribute('aria-label')).toBe('Producto activo');
    expect(root.querySelector('.back-circle')?.getAttribute('aria-label')).toBe('Volver a productos');
  });
});
