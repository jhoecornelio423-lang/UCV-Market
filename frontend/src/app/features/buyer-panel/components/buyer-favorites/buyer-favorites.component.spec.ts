import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { BuyerFavoritesComponent } from './buyer-favorites.component';
import { TEST_PROVIDERS } from 'src/testing/test-providers';

describe('BuyerFavoritesComponent', () => {
  let component: BuyerFavoritesComponent;
  let fixture: ComponentFixture<BuyerFavoritesComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ BuyerFavoritesComponent ],
      imports: [IonicModule.forRoot()],
      providers: TEST_PROVIDERS
    }).compileComponents();

    fixture = TestBed.createComponent(BuyerFavoritesComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
