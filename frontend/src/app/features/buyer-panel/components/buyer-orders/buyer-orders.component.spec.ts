import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { BuyerOrdersComponent } from './buyer-orders.component';
import { RouterModule } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { SupabaseClientService } from '../../../../core/database/supabase.client';
import { ORDER_REPOSITORY } from '../../../../core/repositories/order.repository';
import { PRODUCT_REPOSITORY } from '../../../../core/repositories/product.repository';

describe('BuyerOrdersComponent', () => {
  let component: BuyerOrdersComponent;
  let fixture: ComponentFixture<BuyerOrdersComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ BuyerOrdersComponent ],
      imports: [IonicModule.forRoot(), RouterModule.forRoot([])],
      providers: [
        { provide: AuthService, useValue: { currentProfile$: of(null) } },
        { provide: ORDER_REPOSITORY, useValue: { getBuyerOrders: () => of([]) } },
        { provide: PRODUCT_REPOSITORY, useValue: {} },
        { provide: SupabaseClientService, useValue: { client: {} } },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BuyerOrdersComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('guides the active empty state to explore products', () => {
    component.buyerFilter = 'active';
    component.buyerOrders = [];
    component.loading = false;

    fixture.detectChanges();

    const action = fixture.nativeElement.querySelector('.empty-action') as HTMLAnchorElement | null;
    expect(fixture.nativeElement.textContent).toContain('Todavía no tienes pedidos activos');
    expect(action?.textContent).toContain('Explorar productos');
    expect(action?.getAttribute('href')).toBe('/buyer-panel/explore');
  });

  it('explains the history empty state without showing an action', () => {
    component.buyerFilter = 'history';
    component.buyerOrders = [];
    component.loading = false;

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Aún no tienes compras finalizadas');
    expect(fixture.nativeElement.querySelector('.empty-action')).toBeNull();
  });
});
