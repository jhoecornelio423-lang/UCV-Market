import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { SellerBusinessComponent } from './seller-business.component';
import { TEST_PROVIDERS } from 'src/testing/test-providers';
import { FormsModule } from '@angular/forms';

describe('SellerBusinessComponent', () => {
  let component: SellerBusinessComponent;
  let fixture: ComponentFixture<SellerBusinessComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ SellerBusinessComponent ],
      imports: [IonicModule.forRoot(), FormsModule],
      providers: TEST_PROVIDERS
    }).compileComponents();

    fixture = TestBed.createComponent(SellerBusinessComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses labelled fields, uploads and support action', () => {
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('label[for="business-name"]')).not.toBeNull();
    expect(root.querySelector('label[for="business-avatar"]')).not.toBeNull();
    expect(root.querySelector('#accepting-orders')?.getAttribute('aria-label')).toBe('Aceptar pedidos');
    expect(root.querySelector('button.support-row')).not.toBeNull();
  });
});
