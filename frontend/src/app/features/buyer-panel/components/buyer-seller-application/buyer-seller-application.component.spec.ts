import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { BuyerSellerApplicationComponent } from './buyer-seller-application.component';

describe('BuyerSellerApplicationComponent', () => {
  let component: BuyerSellerApplicationComponent;
  let fixture: ComponentFixture<BuyerSellerApplicationComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ BuyerSellerApplicationComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(BuyerSellerApplicationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
