import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { BuyerProfileComponent } from './buyer-profile.component';
import { TEST_PROVIDERS } from 'src/testing/test-providers';

describe('BuyerProfileComponent', () => {
  let component: BuyerProfileComponent;
  let fixture: ComponentFixture<BuyerProfileComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ BuyerProfileComponent ],
      imports: [IonicModule.forRoot()],
      providers: TEST_PROVIDERS
    }).compileComponents();

    fixture = TestBed.createComponent(BuyerProfileComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
