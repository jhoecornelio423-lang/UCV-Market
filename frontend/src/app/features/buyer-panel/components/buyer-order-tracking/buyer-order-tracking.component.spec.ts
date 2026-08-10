import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { BuyerOrderTrackingComponent } from './buyer-order-tracking.component';

describe('BuyerOrderTrackingComponent', () => {
  let component: BuyerOrderTrackingComponent;
  let fixture: ComponentFixture<BuyerOrderTrackingComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ BuyerOrderTrackingComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(BuyerOrderTrackingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
