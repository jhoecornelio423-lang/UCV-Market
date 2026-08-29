import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { IonicModule, MenuController } from '@ionic/angular';
import { RoleMobileNavigationComponent } from './role-mobile-navigation.component';
import { RoleMobileNavigationConfig } from './role-mobile-navigation.model';

describe('RoleMobileNavigationComponent', () => {
  let fixture: ComponentFixture<RoleMobileNavigationComponent>;
  let component: RoleMobileNavigationComponent;
  let menu: jasmine.SpyObj<MenuController>;

  const config: RoleMobileNavigationConfig = {
    menuId: 'test-menu',
    roleLabel: 'Panel de prueba',
    ariaLabel: 'Navegación de prueba',
    items: [
      { label: 'Inicio', route: '/test/home', icon: 'home-outline' },
      { label: 'Alertas', route: '/test/alerts', icon: 'notifications-outline', badge: 2, badgeTone: 'danger' },
    ],
  };

  beforeEach(async () => {
    const content = document.createElement('div');
    content.id = 'test-content';
    document.body.appendChild(content);
    menu = jasmine.createSpyObj<MenuController>('MenuController', ['open', 'close']);
    menu.open.and.resolveTo(true);
    menu.close.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [RoleMobileNavigationComponent, IonicModule.forRoot(), RouterTestingModule],
      providers: [{ provide: MenuController, useValue: menu }],
    }).compileComponents();

    fixture = TestBed.createComponent(RoleMobileNavigationComponent);
    component = fixture.componentInstance;
    component.config = config;
    component.contentId = 'test-content';
    component.currentPath = '/test/home?tab=all';
    fixture.detectChanges();
  });

  afterEach(() => document.getElementById('test-content')?.remove());

  it('renders the common identity and accessible menu trigger', () => {
    expect(fixture.nativeElement.querySelector('.brand-name')?.textContent).toContain('VALLE-GO');
    expect(fixture.nativeElement.querySelector('.role-label')?.textContent).toContain('Panel de prueba');
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('.menu-trigger');
    expect(trigger.getAttribute('aria-label')).toBe('Abrir menú de navegación');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('marks only the exact normalized route as current and renders badges', () => {
    const links = fixture.nativeElement.querySelectorAll('.drawer-link');
    expect(links[0].getAttribute('aria-current')).toBe('page');
    expect(links[1].hasAttribute('aria-current')).toBeFalse();
    expect(fixture.nativeElement.querySelector('.drawer-badge')?.textContent.trim()).toBe('2');
  });

  it('opens and closes its own menu', async () => {
    await component.openMenu();
    expect(menu.open).toHaveBeenCalledWith('test-menu');

    await component.navigateFromMenu();
    expect(menu.close).toHaveBeenCalledWith('test-menu');
  });

  it('emits logout from the drawer footer', () => {
    const logout = spyOn(component.logout, 'emit');
    fixture.nativeElement.querySelector('.logout-action').click();
    expect(logout).toHaveBeenCalled();
  });
});
