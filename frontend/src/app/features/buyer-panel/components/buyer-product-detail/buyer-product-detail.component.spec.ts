import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { BuyerProductDetailComponent } from './buyer-product-detail.component';
import { TEST_PROVIDERS } from 'src/testing/test-providers';

describe('BuyerProductDetailComponent', () => {
  let component: BuyerProductDetailComponent;
  let fixture: ComponentFixture<BuyerProductDetailComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ BuyerProductDetailComponent ],
      imports: [IonicModule.forRoot()],
      providers: TEST_PROVIDERS
    }).compileComponents();

    fixture = TestBed.createComponent(BuyerProductDetailComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
