import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { SellerBusinessComponent } from './seller-business.component';
import { TEST_PROVIDERS } from 'src/testing/test-providers';

describe('SellerBusinessComponent', () => {
  let component: SellerBusinessComponent;
  let fixture: ComponentFixture<SellerBusinessComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ SellerBusinessComponent ],
      imports: [IonicModule.forRoot()],
      providers: TEST_PROVIDERS
    }).compileComponents();

    fixture = TestBed.createComponent(SellerBusinessComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
