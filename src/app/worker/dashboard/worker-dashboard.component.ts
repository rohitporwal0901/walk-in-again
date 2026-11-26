import { Component, inject, signal, computed, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Firestore, collection, query, where, onSnapshot, Unsubscribe } from '@angular/fire/firestore';
import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';
import { AvatarService } from '../../core/services/avatar.service';
import { Session, calculateSessionEarning } from '../../core/models/session.model';

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
  readonly avatarService = inject(AvatarService);
  private firestore = inject(Firestore);
  private router = inject(Router);

  private sessionsUnsub: Unsubscribe | null = null;
  private usersUnsub: Unsubscribe | null = null;

  readonly workerName = this.auth.userName;
  readonly doctorAvatarUrl = computed(() => this.avatarService.getUserAvatar(this.auth.currentUser()));
  isUploadingAvatar = signal<boolean>(false);
  avatarToastMsg = signal<string>('');

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

  completionRate = computed(() => {
    const total = this.todaySessions().length;
    if (total === 0) return '100%';
    const done = this.completedTodayCount();
    return `${Math.round((done / total) * 100)}%`;
  });

  completionPercentageNumber = computed(() => {
    const total = this.todaySessions().length;
    if (total === 0) return 100;
    const done = this.completedTodayCount();
    return Math.min(100, Math.round((done / total) * 100));
  });

  /**
   * Radial Progress Offset for SVG Circle Gauge (Circumference: 2 * Math.PI * 38 = ~238.76)
   */
  readonly radialProgressOffset = computed(() => {
    const circ = 238.76;
    const pct = Math.min(100, Math.max(0, this.completionPercentageNumber()));
    return circ - (circ * pct) / 100;
  });

  totalEarnings = computed(() => {
    return this.allWorkerSessions()
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + calculateSessionEarning(s), 0);
  });

  /**
   * Accurate 7-Day Weekly Bar Chart Data (Mon - Sun).
   * Calculates real completed/active sessions for each day of the current week.
   */
  readonly weeklyBarChartData = computed(() => {
    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0 is Sun, 1 is Mon, ... 6 is Sat
    const diffToMonday = (currentDayOfWeek + 6) % 7; // Distance from Monday (0 to 6)
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const fullDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const sessions = this.allWorkerSessions();
    const days: Array<{
      day: string;
      fullDay: string;
      dateStr: string;
      count: number;
      heightPercent: number;
      isToday: boolean;
    }> = [];

    let maxCount = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dStr = d.toDateString();

      // Find sessions on this calendar day
      const daySessions = sessions.filter(s => {
        const sDate = this.parseDate(s.date) || this.parseDate(s.createdAt) || this.parseDate(s.updatedAt);
        return sDate ? sDate.toDateString() === dStr : false;
      });

      const completedCount = daySessions.filter(s => s.status === 'completed').length;
      // If completed sessions exist use that count, else all sessions on that day
      const count = completedCount > 0 ? completedCount : daySessions.length;
      if (count > maxCount) maxCount = count;

      const isToday = dStr === now.toDateString();

      days.push({
        day: dayLabels[i],
        fullDay: fullDayLabels[i],
        dateStr: dStr,
        count,
        heightPercent: 0,
        isToday
      });
    }

    const totalSessionsInWeek = days.reduce((acc, curr) => acc + curr.count, 0);

    // If no sessions logged across the current week yet, show balanced baseline chart
    if (totalSessionsInWeek === 0) {
      const demoHeights = [30, 48, 38, 62, 88, 42, 22];
      return days.map((dayItem, index) => ({
        ...dayItem,
        heightPercent: demoHeights[index]
      }));
    }

    // Accurate calculation based on real counts
    const effectiveMax = Math.max(maxCount, 1);
    return days.map(dayItem => {
      let height = 12; // Base minimum height for visibility
      if (dayItem.count > 0) {
        height = Math.max(20, Math.round((dayItem.count / effectiveMax) * 92));
      }
      return {
        ...dayItem,
        heightPercent: height
      };
    });
  });

  /**
   * First 3 unique patient avatars with initials & soft medical colors
   */
  readonly recentPatientAvatars = computed(() => {
    const sessions = this.allWorkerSessions();
    const seen = new Set<string>();
    const list: Array<{ initial: string; name: string; bg: string; text: string }> = [];

    for (const s of sessions) {
      const name = (s.patientName || '').trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        const initial = name.charAt(0).toUpperCase();
        const colors = this.getAvatarColor(name);
        list.push({ initial, name, bg: colors.bg, text: colors.text });
        if (list.length >= 3) break;
      }
    }

    const fallbacks = [
      { initial: 'P', name: 'Patient', bg: '#E0F2FE', text: '#0284C7' },
      { initial: 'A', name: 'Patient', bg: '#EDE9FE', text: '#7C3AED' },
      { initial: 'R', name: 'Patient', bg: '#FCE7F3', text: '#DB2777' },
    ];

    while (list.length < 3) {
      list.push(fallbacks[list.length]);
    }

    return list;
  });

  /**
   * Remaining patients count after 3 avatars
   */
  readonly remainingPatientsCount = computed(() => {
    const total = this.totalPatientsCount();
    const shown = this.recentPatientAvatars().length;
    return total > shown ? total - shown : (total > 3 ? total - 3 : 5);
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

  async onAvatarSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    try {
      this.isUploadingAvatar.set(true);
      const base64 = await this.avatarService.compressAndConvertToBase64(file);
      await this.auth.updateUserAvatar(base64);
      this.showAvatarToast('Doctor photo updated! ✓');
    } catch (err: any) {
      console.error('Error updating doctor avatar:', err);
      this.showAvatarToast(err.message || 'Failed to update photo');
    } finally {
      this.isUploadingAvatar.set(false);
      input.value = '';
    }
  }

  private showAvatarToast(msg: string): void {
    this.avatarToastMsg.set(msg);
    setTimeout(() => this.avatarToastMsg.set(''), 3000);
  }
}
