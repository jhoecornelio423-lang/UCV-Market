import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isBuyerPrimaryRoute } from '../../core/navigation/buyer-navigation';

@Component({
  selector: 'app-buyer-panel',
  templateUrl: './buyer-panel.component.html',
  styleUrls: ['./buyer-panel.component.scss'],
  standalone: false
})
export class BuyerPanelComponent implements OnInit {
  currentPath = '';

  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((event: any) => {
      this.currentPath = event.urlAfterRedirects;
    });
  }

  ngOnInit() {
    this.currentPath = this.router.url;
  }

  get showPrimaryNavigation(): boolean {
    return isBuyerPrimaryRoute(this.currentPath);
  }
}
