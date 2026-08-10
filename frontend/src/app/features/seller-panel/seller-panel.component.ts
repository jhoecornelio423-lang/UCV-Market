import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-seller-panel',
  templateUrl: './seller-panel.component.html',
  styleUrls: ['./seller-panel.component.scss'],
  standalone: false
})
export class SellerPanelComponent {
  private router = inject(Router);

  get showBottomNav(): boolean {
    return !this.router.url.includes('/product-form');
  }
}
