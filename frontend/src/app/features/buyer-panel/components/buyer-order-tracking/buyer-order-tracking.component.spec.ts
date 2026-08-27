import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { BuyerOrderTrackingComponent } from './buyer-order-tracking.component';
import { TEST_PROVIDERS } from 'src/testing/test-providers';

describe('BuyerOrderTrackingComponent', () => {
  let component: BuyerOrderTrackingComponent;
  let fixture: ComponentFixture<BuyerOrderTrackingComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ BuyerOrderTrackingComponent ],
      imports: [IonicModule.forRoot()],
      providers: TEST_PROVIDERS
    }).compileComponents();

    fixture = TestBed.createComponent(BuyerOrderTrackingComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
