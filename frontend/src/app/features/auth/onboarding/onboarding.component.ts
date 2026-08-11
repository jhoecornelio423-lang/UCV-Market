import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.scss'],
  standalone: false
})
export class OnboardingComponent implements OnInit {
  private router = inject(Router);

  ngOnInit(): void {
    const isMobile = window.innerWidth < 860;
    const hasSeenOnboarding = localStorage.getItem('vallego_onboarding_seen') === 'true';

    if (!isMobile || hasSeenOnboarding) {
      this.router.navigate(['/login/login'], { replaceUrl: true });
    }
  }

  goToLogin() {
    localStorage.setItem('vallego_onboarding_seen', 'true');
    this.router.navigate(['/login/login']);
  }
}
