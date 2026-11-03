import { Component, inject, signal, computed, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Firestore, collection, query, where, onSnapshot, Unsubscribe } from '@angular/fire/firestore';
import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';
import { Session } from '../../core/models/session.model';

@Component({
  selector: 'app-worker-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './worker-dashboard.component.html',
  styleUrl: './worker-dashboard.component.scss'
})
export class WorkerDashboardComponent implements OnDestroy {
  private auth = inject(AuthService);
  private sessionService = inject(SessionService);
  private firestore = inject(Firestore);
  private router = inject(Router);

  private sessionsUnsub: Unsubscribe | null = null;
  private usersUnsub: Unsubscribe | null = null;

  readonly workerName = this.auth.userName;

  /**
   * Proper doctor name with "Dr." prefix and full name (e.g. "Dr. Rahul Sharma")
   * Prevents "Hi Dr" cut-off issue.
   */
  readonly doctorDisplayName = computed(() => {
    const raw = (this.workerName() || '').trim();
    const clean = raw.replace(/^(Dr\.?\s*)+/i, '').trim();
    return clean ? `Dr. ${clean}` : (raw || 'Dr. Rahul Sharma');
  });

  allWorkerSessions = signal<Session[]>([]);
  registeredPatientsCount = signal<number>(0);
  isLoading = signal<boolean>(true);

  private parseDate(val: any): Date | null {
    if (!val) return null;
    if (typeof val?.toDate === 'function') return val.toDate();
    if (val?.seconds) return new Date(val.seconds * 1000);
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  // Today's sessions filter: includes completed today, active, and today's queued sessions
  todaySessions = computed(() => {
    const todayStr = new Date().toDateString();
    return this.allWorkerSessions().filter(s => {
      const d = this.parseDate(s.date) || this.parseDate(s.createdAt);
      const u = this.parseDate(s.updatedAt);
      const isDateToday = d ? d.toDateString() === todayStr : false;
      const isUpdatedToday = u ? u.toDateString() === todayStr : false;

      // If completed today or active or scheduled for today
      if (s.status === 'completed' && (isDateToday || isUpdatedToday)) return true;
      if (s.status === 'active') return true;
      if (isDateToday) return true;
      return false;
    });
  });

  // Total registered patients count from database (fallback to session unique patients)
  totalPatientsCount = computed(() => {
    const fromUsers = this.registeredPatientsCount();
    const fromSessions = new Set(this.allWorkerSessions().map(s => s.patientId || s.patientMobile)).size;
    return Math.max(fromUsers, fromSessions);
  });

  completedTodayCount = computed(() => {
    return this.todaySessions().filter(s => s.status === 'completed').length;
  });

  totalEarnings = computed(() => {
    return this.allWorkerSessions()
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + (Number(s.fee) || 0), 0);
  });

  constructor() {
    // 1. Real-time listener for registered patients in clinic
    try {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('role', '==', 'patient'));
      this.usersUnsub = onSnapshot(q, snap => {
        this.registeredPatientsCount.set(snap.size);
      }, err => {
        console.warn('Error loading registered patients:', err);
      });
    } catch (e) {
      console.warn('Failed to setup patient listener:', e);
    }

    // 2. Reactively listen to worker sessions once Firebase Auth resolves
    effect(() => {
      const user = this.auth.currentUser();
      const isLoadingAuth = this.auth.authLoading();

      if (user?.uid) {
        if (this.sessionsUnsub) {
          this.sessionsUnsub();
        }
        this.sessionsUnsub = this.sessionService.listenToWorkerSessions(user.uid, (sessions) => {
          this.allWorkerSessions.set(sessions);
          this.isLoading.set(false);
        });
      } else if (!isLoadingAuth) {
        // Fallback: If unassigned or auth done, attach clinic listener
        if (!this.sessionsUnsub) {
          this.sessionsUnsub = this.sessionService.listenToWorkerSessions('', (sessions) => {
            this.allWorkerSessions.set(sessions);
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
    if (this.usersUnsub) {
      this.usersUnsub();
      this.usersUnsub = null;
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

  startSession(session: Session) {
    this.router.navigate(['/worker/session', session.sessionId]);
  }
}
