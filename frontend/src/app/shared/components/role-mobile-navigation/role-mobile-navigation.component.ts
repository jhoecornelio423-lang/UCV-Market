import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonicModule, MenuController } from '@ionic/angular';
import { normalizeAppPath } from '../../../core/navigation/buyer-navigation';
import { RoleMobileNavigationConfig, RoleMobileNavigationItem } from './role-mobile-navigation.model';

@Component({
  selector: 'app-role-mobile-navigation',
  templateUrl: './role-mobile-navigation.component.html',
  styleUrls: ['./role-mobile-navigation.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule],
})
export class RoleMobileNavigationComponent implements AfterViewInit {
  @Input({ required: true }) config!: RoleMobileNavigationConfig;
  @Input({ required: true }) contentId!: string;
  @Input() currentPath = '';
  @Output() logout = new EventEmitter<void>();

  @ViewChild('menuTrigger', { read: ElementRef }) private menuTrigger?: ElementRef<HTMLButtonElement>;

  isOpen = false;
  menuReady = false;
  private menuController = inject(MenuController);
  private changeDetector = inject(ChangeDetectorRef);

  ngAfterViewInit(): void {
    this.menuReady = true;
    this.changeDetector.detectChanges();
  }

  isActive(route: string): boolean {
    return normalizeAppPath(this.currentPath) === normalizeAppPath(route);
  }

  trackByRoute(_index: number, item: RoleMobileNavigationItem): string {
    return item.route;
  }

  async openMenu(): Promise<void> {
    await this.menuController.open(this.config.menuId);
  }

  onMenuWillOpen(): void {
    this.isOpen = true;
  }

  onMenuDidClose(): void {
    this.isOpen = false;
    this.menuTrigger?.nativeElement.focus();
  }
}
