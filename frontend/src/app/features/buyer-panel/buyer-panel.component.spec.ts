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

  it('delegates bottom navigation only to routerLink', () => {
    spyOn(component, 'goTo');
    fixture.detectChanges();

    const navigationButtons = Array.from(
      fixture.nativeElement.querySelectorAll('.bottom-navigation-figma .nav-item-figma')
    ) as HTMLButtonElement[];

    navigationButtons.forEach(button => button.click());

    expect(navigationButtons.length).toBe(5);
    expect(component.goTo).not.toHaveBeenCalled();
  });
});
