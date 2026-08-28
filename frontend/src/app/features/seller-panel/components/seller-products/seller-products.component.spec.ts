import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { SellerProductsComponent } from './seller-products.component';
import { TEST_PROVIDERS } from 'src/testing/test-providers';
import { Product } from '../../../../core/models/product.model';
import { FormsModule } from '@angular/forms';

describe('SellerProductsComponent', () => {
  let component: SellerProductsComponent;
  let fixture: ComponentFixture<SellerProductsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ SellerProductsComponent ],
      imports: [IonicModule.forRoot(), FormsModule],
      providers: TEST_PROVIDERS
    }).compileComponents();

    fixture = TestBed.createComponent(SellerProductsComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('combines normalized name search and availability status', () => {
    const products = [
      { name: 'Brownie Oreo', is_active: true, stock: 3 },
      { name: 'Brownie clásico', is_active: false, stock: 4 },
      { name: 'Galleta', is_active: true, stock: 0 },
    ] as Product[];
    component.searchTerm = '  brownie ';
    component.statusFilter = 'active';
    expect(component.filterProducts(products).map(product => product.name)).toEqual(['Brownie Oreo']);
    component.statusFilter = 'inactive';
    expect(component.filterProducts(products).map(product => product.name)).toEqual(['Brownie clásico']);
  });

  it('renders labelled filter controls', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#product-search')?.getAttribute('aria-label')).toBe('Buscar productos');
    expect(fixture.nativeElement.querySelector('[aria-label="Filtrar productos por estado"]')).not.toBeNull();
  });
});
