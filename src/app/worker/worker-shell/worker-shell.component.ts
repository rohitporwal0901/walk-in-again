import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-worker-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  template: `
    <div class="mobile-shell">
      <!-- Main Content -->
      <main class="page-scroll" style="height: calc(100vh - 64px);">
        <router-outlet></router-outlet>
      </main>

      <!-- Bottom Navigation -->
      <nav class="bottom-nav">
        <a routerLink="dashboard" routerLinkActive="active" class="nav-item" id="nav-dashboard">
          <span class="nav-icon">🏠</span>
          <span>Home</span>
        </a>
        <a routerLink="search" routerLinkActive="active" class="nav-item" id="nav-search">
          <span class="nav-icon">🔍</span>
          <span>Search</span>
        </a>
        <a routerLink="history" routerLinkActive="active" class="nav-item" id="nav-history">
          <span class="nav-icon">📋</span>
          <span>Sessions</span>
        </a>
        <button class="nav-item" (click)="logout()" id="nav-logout">
          <span class="nav-icon">🚪</span>
          <span>Logout</span>
        </button>
      </nav>
    </div>
  `
})
export class WorkerShellComponent {
  private auth = inject(AuthService);
  logout() { this.auth.logout(); }
}
