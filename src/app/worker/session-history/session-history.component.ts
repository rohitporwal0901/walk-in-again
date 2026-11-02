import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-session-history',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="history-page">
      <header class="history-header">
        <h1>Session History</h1>
        <p>All your completed sessions</p>
      </header>
      <div style="padding:16px">
        <p class="text-secondary text-sm" style="text-align:center;padding:40px">Session history coming soon...</p>
      </div>
    </div>
  `,
  styles: [`
    .history-page { min-height: 100vh; background: var(--bg); }
    .history-header {
      background: linear-gradient(135deg, var(--navy), var(--navy-light));
      padding: 52px 20px 24px;
      h1 { font-size: 24px; font-weight: 800; color: white; margin-bottom: 4px; }
      p  { font-size: 13px; color: rgba(255,255,255,0.7); }
    }
  `]
})
export class SessionHistoryComponent {}
