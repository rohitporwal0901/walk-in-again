import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';
import { Session } from '../../core/models/session.model';
import { Unsubscribe } from '@angular/fire/firestore';

interface MetricCard {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  bgColor: string;
}

@Component({
  selector: 'app-worker-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './worker-dashboard.component.html',
  styleUrl: './worker-dashboard.component.scss'
})
export class WorkerDashboardComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private sessionService = inject(SessionService);
  private router = inject(Router);

  private sessionsUnsub: Unsubscribe | null = null;

  readonly workerName = this.auth.userName;
  readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  });

  allWorkerSessions = signal<Session[]>([]);
  isLoading = signal<boolean>(true);

  // Today's sessions filter
  todaySessions = computed(() => {
    const todayStr = new Date().toDateString();
    return this.allWorkerSessions().filter(s => {
      const d = new Date(s.date);
      return d.toDateString() === todayStr || s.status === 'active';
    });
  });

  // Dynamic Real Metrics computed from actual Firestore records
  metrics = computed<MetricCard[]>(() => {
    const all = this.allWorkerSessions();
    const today = this.todaySessions();

    const uniquePatients = new Set(all.map(s => s.patientId || s.patientMobile)).size;
    const todayCount = today.length;
    const completedToday = today.filter(s => s.status === 'completed').length;
    const totalEarnings = all
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + (Number(s.fee) || 0), 0);

    return [
      { label: 'Total Patients', value: uniquePatients, icon: '👤', color: '#2196F3', bgColor: '#EFF6FF' },
      { label: "Today's", value: todayCount, icon: '📅', color: '#22C55E', bgColor: '#DCFCE7' },
      { label: 'Completed', value: completedToday, icon: '✅', color: '#F59E0B', bgColor: '#FEF3C7' },
      { label: 'Earnings', value: `₹${totalEarnings.toLocaleString('en-IN')}`, icon: '💰', color: '#F4A62A', bgColor: '#FFF8E7' },
    ];
  });

  ngOnInit() {
    const user = this.auth.currentUser();
    if (user?.uid) {
      this.sessionsUnsub = this.sessionService.listenToWorkerSessions(user.uid, (sessions) => {
        this.allWorkerSessions.set(sessions);
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

  startSession(session: Session) {
    this.router.navigate(['/worker/session', session.sessionId]);
  }
}
