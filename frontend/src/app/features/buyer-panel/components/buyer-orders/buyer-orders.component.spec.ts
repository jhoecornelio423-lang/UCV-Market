import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { BuyerOrdersComponent } from './buyer-orders.component';
import { TEST_PROVIDERS } from 'src/testing/test-providers';

describe('BuyerOrdersComponent', () => {
  let component: BuyerOrdersComponent;
  let fixture: ComponentFixture<BuyerOrdersComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ BuyerOrdersComponent ],
      imports: [IonicModule.forRoot()],
      providers: TEST_PROVIDERS
    }).compileComponents();

    fixture = TestBed.createComponent(BuyerOrdersComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
