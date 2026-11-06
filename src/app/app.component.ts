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
      <!-- YouTube / LinkedIn Style Minimalist Fullscreen Splash Screen -->
      <div class="app-splash-screen" id="app-splash">
        <div class="splash-center-content">
          <!-- Brand Icon Squircle -->
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

          <!-- YouTube / LinkedIn Indeterminate Sliding Progress Bar (Wide & Smooth) -->
          <div class="yt-progress-container" role="progressbar" aria-label="Loading application">
            <div class="yt-progress-bar">
              <div class="yt-bar-line bar-primary"></div>
              <div class="yt-bar-line bar-secondary"></div>
            </div>
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

    /* ─── YouTube / LinkedIn Clean Fullscreen Splash ───────────────────────── */
    .app-splash-screen {
      position: fixed;
      inset: 0;
      background: #FFFFFF;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      animation: splashFadeIn 0.2s ease-out;
    }

    .splash-center-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      max-width: 360px;
      width: 100%;
    }

    .splash-logo-wrap {
      margin-bottom: 20px;
      filter: drop-shadow(0 10px 24px rgba(11, 37, 69, 0.14));
      animation: logoFloat 2.6s ease-in-out infinite;
    }

    .splash-brand-title {
      font-size: 25px;
      font-weight: 800;
      color: #0F172A;
      margin: 0 0 5px;
      letter-spacing: -0.025em;
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
      margin: 0 0 28px;
    }

    /* ─── YouTube / LinkedIn Material Indeterminate Linear Progress Bar ─────── */
    .yt-progress-container {
      width: 260px;
      max-width: 100%;
      display: flex;
      justify-content: center;
    }

    .yt-progress-bar {
      position: relative;
      width: 100%;
      height: 4px;
      background: #E5E7EB;
      border-radius: 999px;
      overflow: hidden;
    }

    /* YouTube / Material dual-sliding lines */
    .yt-bar-line {
      position: absolute;
      top: 0;
      bottom: 0;
      background: #0284C7;
      border-radius: 999px;
      will-change: left, right;
    }

    .bar-primary {
      animation: ytIndeterminate1 2s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite;
    }

    .bar-secondary {
      animation: ytIndeterminate2 2s cubic-bezier(0.165, 0.84, 0.44, 1) 1.15s infinite;
    }

    @keyframes ytIndeterminate1 {
      0% {
        left: -35%;
        right: 100%;
      }
      60% {
        left: 100%;
        right: -90%;
      }
      100% {
        left: 100%;
        right: -90%;
      }
    }

    @keyframes ytIndeterminate2 {
      0% {
        left: -200%;
        right: 100%;
      }
      60% {
        left: 107%;
        right: -8%;
      }
      100% {
        left: 107%;
        right: -8%;
      }
    }

    @keyframes logoFloat {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-3px);
      }
    }

    @keyframes splashFadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  `]
})
export class AppComponent {
  auth = inject(AuthService);
}
