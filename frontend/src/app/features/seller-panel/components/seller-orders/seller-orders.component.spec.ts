import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { SellerOrdersComponent } from './seller-orders.component';
import { TEST_PROVIDERS } from 'src/testing/test-providers';

describe('SellerOrdersComponent', () => {
  let component: SellerOrdersComponent;
  let fixture: ComponentFixture<SellerOrdersComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ SellerOrdersComponent ],
      imports: [IonicModule.forRoot()],
      providers: TEST_PROVIDERS
    }).compileComponents();

    fixture = TestBed.createComponent(SellerOrdersComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exposes selected tabs and descriptive empty states', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.segment-btn')?.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelector('.empty-state ion-icon')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.empty-state h2')).not.toBeNull();
  });
});
