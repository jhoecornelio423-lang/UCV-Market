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

  it('uses native controls for changing the avatar and opening profile statistics', () => {
    fixture.detectChanges();

    const cameraButton = fixture.nativeElement.querySelector('.camera-btn') as HTMLButtonElement;
    const statControls = Array.from(
      fixture.nativeElement.querySelectorAll('.stats-card button.stat-item')
    ) as HTMLButtonElement[];

    expect(cameraButton.getAttribute('aria-label')).toBe('Cambiar foto de perfil');
    expect(statControls.map(button => button.textContent?.trim())).toEqual([
      jasmine.stringMatching(/Pedidos/),
      jasmine.stringMatching(/Favoritos/),
    ]);
  });
});
