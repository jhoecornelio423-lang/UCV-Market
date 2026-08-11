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
  }

  goToLogin() {
    this.router.navigate(['/login/login']);
  }
}
