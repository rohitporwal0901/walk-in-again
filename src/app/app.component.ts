import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    @if (auth.authLoading()) {
      <!-- LinkedIn-Style Initial Loading / Splash Screen -->
      <div class="app-splash-screen" id="app-splash">
        <div class="splash-card">
          <!-- Animated Brand Icon Squircle -->
          <div class="splash-logo-wrap">
            <svg class="splash-logo-svg" viewBox="0 0 128 128" width="76" height="76">
              <defs>
                <linearGradient id="splashBg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#0B2545" />
                  <stop offset="100%" stop-color="#0284C7" />
                </linearGradient>
                <linearGradient id="splashCross" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#FFFFFF" />
                  <stop offset="100%" stop-color="#F0F9FF" />
                </linearGradient>
              </defs>
              <rect x="4" y="4" width="120" height="120" rx="30" fill="url(#splashBg)" stroke="#38BDF8" stroke-width="3" stroke-opacity="0.5"/>
              <rect x="49" y="24" width="30" height="80" rx="9" fill="url(#splashCross)"/>
              <rect x="24" y="49" width="80" height="30" rx="9" fill="url(#splashCross)"/>
              <circle cx="64" cy="64" r="14" fill="#0284C7"/>
              <circle cx="64" cy="64" r="8" fill="#10B981"/>
              <circle cx="61.5" cy="61.5" r="2.8" fill="#FFFFFF" opacity="0.9"/>
            </svg>
          </div>

          <!-- Brand Typography -->
          <h1 class="splash-brand-title">Walk In Again</h1>
          <span class="splash-brand-category">PHYSIOTHERAPY</span>
          <p class="splash-tagline">Move Better. Live Stronger.</p>

          <!-- LinkedIn-Style Indeterminate Sliding Progress Bar -->
          <div class="linkedin-loader" role="progressbar" aria-label="Loading application">
            <div class="loader-slide-bar"></div>
          </div>
        </div>
      </div>
    } @else {
      <router-outlet></router-outlet>
    }
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      min-height: 100dvh;
    }

    /* ─── LinkedIn-Style Splash Screen ───────────────────────────────────────── */
    .app-splash-screen {
      position: fixed;
      inset: 0;
      background: #EBF5F9;
      background: radial-gradient(circle at 50% 35%, #F0F9FD 0%, #E2EEF5 100%);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      animation: splashFadeIn 0.25s ease-out;
    }

    .splash-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      max-width: 320px;
      width: 100%;
    }

    .splash-logo-wrap {
      margin-bottom: 18px;
      filter: drop-shadow(0 10px 22px rgba(11, 37, 69, 0.16));
      animation: logoFloat 2.4s ease-in-out infinite;
    }

    .splash-brand-title {
      font-size: 24px;
      font-weight: 800;
      color: #0F172A;
      margin: 0 0 4px;
      letter-spacing: -0.02em;
    }

    .splash-brand-category {
      font-size: 11px;
      font-weight: 800;
      color: #0284C7;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }

    .splash-tagline {
      font-size: 13px;
      color: #64748B;
      font-weight: 500;
      margin: 0 0 26px;
    }

    /* ─── LinkedIn-Style Indeterminate Sliding Bar ────────────────────────────── */
    .linkedin-loader {
      width: 150px;
      height: 3.5px;
      background: rgba(2, 132, 199, 0.15);
      border-radius: 9999px;
      overflow: hidden;
      position: relative;
    }

    .loader-slide-bar {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 45%;
      background: linear-gradient(90deg, #0284C7 0%, #38BDF8 50%, #0284C7 100%);
      border-radius: 9999px;
      animation: linkedinSlide 1.3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }

    @keyframes linkedinSlide {
      0% {
        left: -45%;
        width: 35%;
      }
      50% {
        left: 30%;
        width: 60%;
      }
      100% {
        left: 100%;
        width: 35%;
      }
    }

    @keyframes logoFloat {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-4px);
      }
    }

    @keyframes splashFadeIn {
      from {
        opacity: 0;
        transform: scale(0.98);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  `]
})
export class AppComponent {
  auth = inject(AuthService);
}
