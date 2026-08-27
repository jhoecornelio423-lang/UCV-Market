import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { BuyerPanelComponent } from './buyer-panel.component';
import { TEST_PROVIDERS } from 'src/testing/test-providers';

describe('BuyerPanelComponent', () => {
  let component: BuyerPanelComponent;
  let fixture: ComponentFixture<BuyerPanelComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ BuyerPanelComponent ],
      imports: [IonicModule.forRoot()],
      providers: TEST_PROVIDERS
    }).compileComponents();

    fixture = TestBed.createComponent(BuyerPanelComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
