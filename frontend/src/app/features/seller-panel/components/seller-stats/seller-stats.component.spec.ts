import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { SellerStatsComponent } from './seller-stats.component';
import { TEST_PROVIDERS } from 'src/testing/test-providers';
import { of } from 'rxjs';
import { SellerStateService } from '../../services/seller-state.service';

describe('SellerStatsComponent', () => {
  let component: SellerStatsComponent;
  let fixture: ComponentFixture<SellerStatsComponent>;

  beforeEach(waitForAsync(() => {
    const stats = {
      totalSales: 10,
      totalOrders: 1,
      avgTicket: 10,
      newCustomersCount: 1,
      incomeGrowth: 0,
      ordersGrowth: 0,
      ticketGrowth: 0,
      customerGrowth: 0,
      categoryStats: [],
      topProducts: [{ name: 'Brownie', total: 10, qty: 1, percent: 100 }],
      monthlySalesData: [{
        label: '1–2 ago', sales: 10, orders: 1,
        start: new Date(2026, 7, 1), endExclusive: new Date(2026, 7, 3),
      }],
      salesData: [{ day: '1–2 ago', ventas: 10, orders: 1 }],
    };
    TestBed.configureTestingModule({
      declarations: [ SellerStatsComponent ],
      imports: [IonicModule.forRoot()],
      providers: [
        ...TEST_PROVIDERS,
        {
          provide: SellerStateService,
          useValue: { stats$: of(stats), userProfile$: of({ full_name: 'Sweet Corner' }), statsSubject: { value: stats } },
        },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SellerStatsComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('presents the current month without title-casing Spanish prepositions', () => {
    component.currentMonthYear = 'agosto de 2026';
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('agosto de 2026');
    expect(fixture.nativeElement.textContent).toContain('Ventas por semana');
    expect(fixture.nativeElement.textContent).not.toContain('Esta semana');
  });

  it('exposes chart points to assistive technology and pluralizes sold units', () => {
    fixture.detectChanges();

    const point = fixture.nativeElement.querySelector('[data-testid="monthly-chart-point"]');
    expect(point?.getAttribute('aria-label')).toContain('1–2 ago');
    expect(point?.getAttribute('aria-label')).toContain('1 pedido');
    expect(point?.getAttribute('r')).toBe('65');
    expect(fixture.nativeElement.textContent).toContain('1 unidad vendida');
  });
});
