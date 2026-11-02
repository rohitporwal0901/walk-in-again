import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-patient-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  template: `
    <div class="mobile-shell">
      <main class="page-scroll" style="height: calc(100vh - 64px);">
        <router-outlet></router-outlet>
      </main>
      <nav class="bottom-nav">
        <a routerLink="home" routerLinkActive="active" class="nav-item" id="pt-nav-home">
          <span class="nav-icon">🏠</span><span>Home</span>
        </a>
        <a routerLink="sessions" routerLinkActive="active" class="nav-item" id="pt-nav-sessions">
          <span class="nav-icon">📋</span><span>Sessions</span>
        </a>
        <a routerLink="payments" routerLinkActive="active" class="nav-item" id="pt-nav-payments">
          <span class="nav-icon">💳</span><span>Payments</span>
        </a>
        <button class="nav-item" (click)="logout()" id="pt-nav-logout">
          <span class="nav-icon">🚪</span><span>Logout</span>
        </button>
      </nav>
    </div>
  `
})
export class PatientShellComponent {
  private auth = inject(AuthService);
  logout() { this.auth.logout(); }
}
