import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionService } from '../../core/services/session.service';
import { AuthService } from '../../core/services/auth.service';
import { Session } from '../../core/models/session.model';
import { Unsubscribe } from '@angular/fire/firestore';

@Component({
  selector: 'app-session-history',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="history-page">
      <header class="history-header">
        <h1>Completed Sessions</h1>
        <p>Log of your treated physiotherapy patients</p>
      </header>

      <div class="history-content">
        @if (isLoading()) {
          <div class="loading-state">
            <span class="spinner"></span>
            <p>Loading history...</p>
          </div>
        } @else {
          @for (session of completedSessions(); track session.sessionId; let i = $index) {
            <div class="history-card animate-fade-in-up stagger-{{ i + 1 }}">
              <div class="card-left">
                <div class="patient-avatar">{{ (session.patientName || 'P').charAt(0).toUpperCase() }}</div>
                <div>
                  <h3 class="patient-name">{{ session.patientName }}</h3>
                  <p class="patient-meta">+91 {{ session.patientMobile }} · {{ session.date | date:'mediumDate' }}</p>
                  @if (session.notes) {
                    <p class="patient-notes">{{ session.notes }}</p>
                  }
                </div>
              </div>
              <div class="card-right">
                <span class="fee-badge">₹{{ session.fee || 500 }}</span>
                <span class="duration-text">{{ session.duration || 30 }} mins</span>
              </div>
            </div>
          }

          @if (completedSessions().length === 0) {
            <div class="empty-state">
              <span class="empty-icon">📋</span>
              <h3>No Completed Sessions Yet</h3>
              <p>When you complete a walk-in therapy session, it will show up here.</p>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .history-page { min-height: 100vh; background: var(--bg); padding-bottom: 80px; }
    .history-header {
      background: linear-gradient(135deg, #0B2545, #1565C0);
      padding: 40px 20px 24px;
      h1 { font-size: 22px; font-weight: 800; color: white; margin: 0 0 4px; }
      p  { font-size: 13px; color: rgba(255,255,255,0.75); margin: 0; }
    }
    .history-content { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .history-card {
      background: white; border-radius: 16px; padding: 16px; display: flex;
      justify-content: space-between; align-items: center; border: 1px solid #E2E8F0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.03);
    }
    .card-left { display: flex; gap: 12px; align-items: center; }
    .patient-avatar {
      width: 44px; height: 44px; border-radius: 50%;
      background: linear-gradient(135deg, #0B2545, #1565C0);
      color: white; font-weight: 800; font-size: 16px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .patient-name { font-size: 15px; font-weight: 700; color: #0B2545; margin: 0 0 2px; }
    .patient-meta { font-size: 12px; color: #64748B; margin: 0 0 4px; }
    .patient-notes { font-size: 11.5px; color: #1E293B; background: #F8FAFC; padding: 2px 6px; border-radius: 6px; display: inline-block; margin: 0; }
    .card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .fee-badge { background: #DCFCE7; color: #166534; font-weight: 800; font-size: 14px; padding: 4px 10px; border-radius: 8px; }
    .duration-text { font-size: 11.5px; color: #64748B; }
    .empty-state { text-align: center; padding: 60px 20px; background: white; border-radius: 16px; border: 1px dashed #CBD5E1; }
    .empty-icon { font-size: 40px; display: block; margin-bottom: 8px; }
    .empty-state h3 { font-size: 16px; font-weight: 700; color: #0B2545; margin: 0 0 4px; }
    .empty-state p { font-size: 13px; color: #64748B; margin: 0; }
    .loading-state { text-align: center; padding: 40px 20px; color: #64748B; }
  `]
})
export class SessionHistoryComponent implements OnInit, OnDestroy {
  private sessionService = inject(SessionService);
  private auth = inject(AuthService);

  private sessionsUnsub: Unsubscribe | null = null;
  allSessions = signal<Session[]>([]);
  isLoading = signal<boolean>(true);

  completedSessions = computed(() =>
    this.allSessions().filter(s => s.status === 'completed')
  );

  ngOnInit() {
    const user = this.auth.currentUser();
    if (user?.uid) {
      this.sessionsUnsub = this.sessionService.listenToWorkerSessions(user.uid, (sessions) => {
        this.allSessions.set(sessions);
        this.isLoading.set(false);
      });
    } else {
      this.isLoading.set(false);
    }
  }

  ngOnDestroy() {
    if (this.sessionsUnsub) {
      this.sessionsUnsub();
      this.sessionsUnsub = null;
    }
  }
}
