import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';
import { Session } from '../../core/models/session.model';
import { Unsubscribe } from '@angular/fire/firestore';

interface QuickAction {
  id: string;
  icon: string;
  label: string;
  sublabel: string;
  route: string;
  color: string;
  bgColor: string;
}

@Component({
  selector: 'app-patient-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './patient-home.component.html',
  styleUrl: './patient-home.component.scss'
})
export class PatientHomeComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private sessionService = inject(SessionService);
  private router = inject(Router);

  private sessionsUnsub: Unsubscribe | null = null;

  readonly patientName = this.auth.userName;
  readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  });

  // Real Firestore sessions for current patient
  patientSessions = signal<Session[]>([]);
  isLoadingSessions = signal<boolean>(true);

  // Real computed counts
  completedSessions = computed(() =>
    this.patientSessions().filter(s => s.status === 'completed').length
  );
  totalRecommendedSessions = computed(() => {
    const done = this.completedSessions();
    return Math.max(10, done + 2);
  });
  progressPercent = computed(() => {
    const total = this.totalRecommendedSessions();
    if (total === 0) return 0;
    return Math.min(100, Math.round((this.completedSessions() / total) * 100));
  });

  // Active or most recent pending session
  activeSession = computed(() =>
    this.patientSessions().find(s => s.status === 'active' || s.status === 'pending') || null
  );

  quickActions: QuickAction[] = [
    { id: 'track-sessions', icon: '📈', label: 'My Sessions', sublabel: 'History & Notes', route: '/patient/sessions', color: '#22C55E', bgColor: '#DCFCE7' },
    { id: 'payments', icon: '💳', label: 'Payments', sublabel: 'Razorpay Receipts', route: '/patient/payments', color: '#F4A62A', bgColor: '#FFF8E7' },
  ];

  ngOnInit() {
    const user = this.auth.currentUser();
    if (user?.uid) {
      this.sessionsUnsub = this.sessionService.listenToPatientSessions(user.uid, (sessions) => {
        this.patientSessions.set(sessions);
        this.isLoadingSessions.set(false);
      });
    } else {
      this.isLoadingSessions.set(false);
    }
  }

  ngOnDestroy() {
    if (this.sessionsUnsub) {
      this.sessionsUnsub();
      this.sessionsUnsub = null;
    }
  }

  navigate(route: string) {
    this.router.navigate([route]);
  }
}
