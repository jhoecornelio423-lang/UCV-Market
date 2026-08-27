import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { BuyerExploreComponent } from './buyer-explore.component';
import { TEST_PROVIDERS } from 'src/testing/test-providers';

describe('BuyerExploreComponent', () => {
  let component: BuyerExploreComponent;
  let fixture: ComponentFixture<BuyerExploreComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ BuyerExploreComponent ],
      imports: [IonicModule.forRoot()],
      providers: TEST_PROVIDERS
    }).compileComponents();

    fixture = TestBed.createComponent(BuyerExploreComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
