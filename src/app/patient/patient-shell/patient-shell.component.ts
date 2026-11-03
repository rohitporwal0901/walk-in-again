import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-patient-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  template: `
    <div class="mobile-shell" style="background: #EBF5F9;">
      <main class="page-scroll">
        <router-outlet></router-outlet>
      </main>

      <!-- Bottom Nav -->
      <nav class="bottom-nav">
        <a routerLink="home" routerLinkActive="active" class="nav-item" id="pt-nav-home">
          <svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span>Home</span>
        </a>
        <a routerLink="sessions" routerLinkActive="active" class="nav-item" id="pt-nav-sessions">
          <svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>Sessions</span>
        </a>
        <a routerLink="payments" routerLinkActive="active" class="nav-item" id="pt-nav-payments">
          <svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
            <line x1="1" y1="10" x2="23" y2="10"></line>
          </svg>
          <span>Payments</span>
        </a>
        <a routerLink="subscription" routerLinkActive="active" class="nav-item" id="pt-nav-plans">
          <svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
          </svg>
          <span>Plans</span>
        </a>
        <button class="nav-item" (click)="openLogoutConfirm()" id="pt-nav-logout" type="button" aria-label="Logout">
          <svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span>Logout</span>
        </button>
      </nav>

      <!-- Logout Confirmation Modal -->
      @if (showLogoutConfirm()) {
        <div class="logout-modal-backdrop" (click)="closeLogoutConfirm()">
          <div class="logout-modal-card" (click)="$event.stopPropagation()">
            <div class="modal-icon-bubble">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </div>

            <h3 class="modal-title">Sign Out</h3>
            <p class="modal-desc">Are you sure you want to log out of your Patient account?</p>

            <div class="modal-actions">
              <button type="button" class="btn-cancel" (click)="closeLogoutConfirm()" id="pt-logout-cancel">
                Cancel
              </button>
              <button type="button" class="btn-confirm-logout" (click)="confirmLogout()" id="pt-logout-confirm">
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .logout-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(4px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: fadeIn 0.18s ease;
    }

    .logout-modal-card {
      background: #FFFFFF;
      border-radius: 22px;
      padding: 24px 20px;
      width: 100%;
      max-width: 320px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(15, 23, 42, 0.22);
      border: 1px solid rgba(226, 232, 240, 0.8);
      animation: scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .modal-icon-bubble {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: #FEE2E2;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 14px;
      box-shadow: 0 4px 12px rgba(220, 38, 38, 0.15);
    }

    .modal-title {
      font-size: 18px;
      font-weight: 800;
      color: #0F172A;
      margin: 0 0 6px;
      letter-spacing: -0.01em;
    }

    .modal-desc {
      font-size: 13.5px;
      color: #64748B;
      margin: 0 0 20px;
      line-height: 1.45;
    }

    .modal-actions {
      display: flex;
      gap: 10px;
    }

    .btn-cancel {
      flex: 1;
      padding: 12px;
      border-radius: 12px;
      border: 1.5px solid #E2E8F0;
      background: #F8FAFC;
      color: #334155;
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s ease;

      &:hover {
        background: #F1F5F9;
      }
    }

    .btn-confirm-logout {
      flex: 1;
      padding: 12px;
      border-radius: 12px;
      border: none;
      background: #DC2626;
      color: #FFFFFF;
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);
      transition: background 0.15s ease, transform 0.15s ease;

      &:hover {
        background: #B91C1C;
        transform: translateY(-1px);
      }

      &:active {
        transform: scale(0.98);
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes scaleUp {
      from { opacity: 0; transform: scale(0.92); }
      to { opacity: 1; transform: scale(1); }
    }
  `]
})
export class PatientShellComponent {
  private auth = inject(AuthService);
  showLogoutConfirm = signal<boolean>(false);

  openLogoutConfirm() {
    this.showLogoutConfirm.set(true);
  }

  closeLogoutConfirm() {
    this.showLogoutConfirm.set(false);
  }

  confirmLogout() {
    this.showLogoutConfirm.set(false);
    this.auth.logout();
  }
}
