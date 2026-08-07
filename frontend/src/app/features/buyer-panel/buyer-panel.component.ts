import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-buyer-panel',
  templateUrl: './buyer-panel.component.html',
  styleUrls: ['./buyer-panel.component.scss'],
  standalone: false
})
export class BuyerPanelComponent implements OnInit {
  currentPath = '';

  constructor(private router: Router) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentPath = event.urlAfterRedirects;
    });
  }

  ngOnInit() {
    this.currentPath = this.router.url;
  }

  goTo(path: string) {
    this.router.navigate([path]);
  }
}
