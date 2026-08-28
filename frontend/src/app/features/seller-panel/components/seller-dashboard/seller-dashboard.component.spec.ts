import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { SellerDashboardComponent } from './seller-dashboard.component';
import { TEST_PROVIDERS } from 'src/testing/test-providers';

describe('SellerDashboardComponent', () => {
  let component: SellerDashboardComponent;
  let fixture: ComponentFixture<SellerDashboardComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ SellerDashboardComponent ],
      imports: [IonicModule.forRoot()],
      providers: TEST_PROVIDERS
    }).compileComponents();

    fixture = TestBed.createComponent(SellerDashboardComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('names icon actions and uses Spanish rating copy', () => {
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.notif-btn')?.getAttribute('aria-label')).toBe('Abrir notificaciones');
    expect(root.querySelector('.profile-btn')?.getAttribute('aria-label')).toBe('Cerrar sesión');
    expect(root.textContent).toContain('Calificación');
    expect(root.textContent).not.toContain('Rating');
  });
});
