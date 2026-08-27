import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { BuyerSellerApplicationComponent } from './buyer-seller-application.component';
import { TEST_PROVIDERS } from 'src/testing/test-providers';

describe('BuyerSellerApplicationComponent', () => {
  let component: BuyerSellerApplicationComponent;
  let fixture: ComponentFixture<BuyerSellerApplicationComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ BuyerSellerApplicationComponent ],
      imports: [IonicModule.forRoot()],
      providers: TEST_PROVIDERS
    }).compileComponents();

    fixture = TestBed.createComponent(BuyerSellerApplicationComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
