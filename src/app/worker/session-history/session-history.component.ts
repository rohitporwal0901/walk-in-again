import { Component, signal, computed, inject, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { AuthService } from '../../core/services/auth.service';
import { Session, calculateSessionEarning } from '../../core/models/session.model';
import { Unsubscribe } from '@angular/fire/firestore';

@Component({
  selector: 'app-session-history',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './session-history.component.html',
  styleUrl: './session-history.component.scss'
})
export class SessionHistoryComponent implements OnDestroy {
  private sessionService = inject(SessionService);
  private auth = inject(AuthService);
  private router = inject(Router);

  calculateSessionEarning = calculateSessionEarning;

  private sessionsUnsub: Unsubscribe | null = null;
  allSessions = signal<Session[]>([]);
  isLoading = signal<boolean>(true);

  completedSessions = computed(() => {
    return this.allSessions()
      .filter(s => s.status === 'completed')
      .sort((a, b) => {
        const timeA = new Date(a.date || a.updatedAt || 0).getTime();
        const timeB = new Date(b.date || b.updatedAt || 0).getTime();
        return timeB - timeA;
      });
  });

  totalEarnings = computed(() => {
    return this.completedSessions().reduce((sum, s) => sum + calculateSessionEarning(s), 0);
  });

  constructor() {
    // Reactively listen to sessions as soon as auth state is ready
    effect(() => {
      const user = this.auth.currentUser();
      const isAuthLoading = this.auth.authLoading();

      if (user?.uid) {
        if (this.sessionsUnsub) {
          this.sessionsUnsub();
        }
        this.sessionsUnsub = this.sessionService.listenToWorkerSessions(user.uid, (sessions) => {
          this.allSessions.set(sessions);
          this.isLoading.set(false);
        });
      } else if (!isAuthLoading) {
        if (!this.sessionsUnsub) {
          this.sessionsUnsub = this.sessionService.listenToWorkerSessions('', (sessions) => {
            this.allSessions.set(sessions);
            this.isLoading.set(false);
          });
        }
        this.isLoading.set(false);
      }
    });
  }

  ngOnDestroy() {
    if (this.sessionsUnsub) {
      this.sessionsUnsub();
      this.sessionsUnsub = null;
    }
  }

  getAvatarColor(name: string): { bg: string; text: string } {
    const palette = [
      { bg: '#FED7AA', text: '#9A3412' }, // warm amber
      { bg: '#E0F2FE', text: '#0369A1' }, // sky blue
      { bg: '#FCE7F3', text: '#BE185D' }, // rose pink
      { bg: '#DCFCE7', text: '#15803D' }, // emerald green
      { bg: '#EDE9FE', text: '#6D28D9' }, // violet
      { bg: '#FEF08A', text: '#854D0E' }, // sunny yellow
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % palette.length;
    return palette[index];
  }

  getTherapiesSummary(session: Session): string {
    if (!session.therapies || session.therapies.length === 0) return '';
    return session.therapies
      .filter(t => t.checked)
      .map(t => t.label)
      .join(', ');
  }

  getEndTime(session: Session): string {
    const raw = session.updatedAt || session.date;
    if (!raw) return '';
    try {
      const d = typeof raw?.toDate === 'function' ? raw.toDate() : new Date(raw?.seconds ? raw.seconds * 1000 : raw);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  }

  goBack() {
    this.router.navigate(['/worker/dashboard']);
  }
}
