import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { BuyerCatalogComponent } from './buyer-catalog.component';
import { TEST_PROVIDERS } from 'src/testing/test-providers';

describe('BuyerCatalogComponent', () => {
  let component: BuyerCatalogComponent;
  let fixture: ComponentFixture<BuyerCatalogComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ BuyerCatalogComponent ],
      imports: [IonicModule.forRoot()],
      providers: TEST_PROVIDERS
    }).compileComponents();

    fixture = TestBed.createComponent(BuyerCatalogComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
