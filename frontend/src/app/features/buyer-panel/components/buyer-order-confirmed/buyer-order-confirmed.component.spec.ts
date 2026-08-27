import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { BuyerOrderConfirmedComponent } from './buyer-order-confirmed.component';
import { TEST_PROVIDERS } from 'src/testing/test-providers';

describe('BuyerOrderConfirmedComponent', () => {
  let component: BuyerOrderConfirmedComponent;
  let fixture: ComponentFixture<BuyerOrderConfirmedComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ BuyerOrderConfirmedComponent ],
      imports: [IonicModule.forRoot()],
      providers: TEST_PROVIDERS
    }).compileComponents();

    fixture = TestBed.createComponent(BuyerOrderConfirmedComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
