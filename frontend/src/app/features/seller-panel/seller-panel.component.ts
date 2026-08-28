import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { isSellerPrimaryRoute } from '../../core/navigation/seller-navigation';

@Component({
  selector: 'app-seller-panel',
  templateUrl: './seller-panel.component.html',
  styleUrls: ['./seller-panel.component.scss'],
  standalone: false
})
export class SellerPanelComponent {
  private router = inject(Router);

  get showBottomNav(): boolean {
    return isSellerPrimaryRoute(this.router.url);
  }
}
