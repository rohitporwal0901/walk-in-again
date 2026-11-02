import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';
import { Session } from '../../core/models/session.model';

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
  imports: [CommonModule],
  templateUrl: './worker-dashboard.component.html',
  styleUrl: './worker-dashboard.component.scss'
})
export class WorkerDashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private sessionService = inject(SessionService);
  private router = inject(Router);

  readonly workerName = this.auth.userName;
  readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  });

  todaySessions = signal<Session[]>([]);
  isLoading = signal<boolean>(true);

  metrics: MetricCard[] = [
    { label: 'Total Patients', value: 12, icon: '👤', color: '#2196F3', bgColor: '#EFF6FF' },
    { label: "Today's", value: 8, icon: '📅', color: '#22C55E', bgColor: '#DCFCE7' },
    { label: 'Completed', value: 6, icon: '✅', color: '#F59E0B', bgColor: '#FEF3C7' },
    { label: 'Earnings', value: '₹4,200', icon: '💰', color: '#F4A62A', bgColor: '#FFF8E7' },
  ];

  ngOnInit() {
    const user = this.auth.currentUser();
    if (!user) return;

    this.sessionService.getTodaySessionsByWorker(user.mobileNumber).subscribe({
      next: (sessions) => {
        this.todaySessions.set(sessions);
        this.isLoading.set(false);
      },
      error: () => {
        // Fallback to mock data for demo
        this.todaySessions.set(this.getMockSessions());
        this.isLoading.set(false);
      }
    });
  }

  startSession(session: Session) {
    this.router.navigate(['/worker/session', session.sessionId]);
  }

  private getMockSessions(): Session[] {
    return [
      {
        sessionId: 'sess_001', patientId: 'p1', patientName: 'Anita Sharma',
        workerId: 'w1', workerName: 'Rahul', date: new Date(),
        timeSlot: '10:00 AM', duration: 0, status: 'pending',
        therapies: [], notes: '', fee: 500,
        createdAt: new Date(), updatedAt: new Date()
      },
      {
        sessionId: 'sess_002', patientId: 'p2', patientName: 'Pooja Mehta',
        workerId: 'w1', workerName: 'Rahul', date: new Date(),
        timeSlot: '11:30 AM', duration: 0, status: 'pending',
        therapies: [], notes: '', fee: 500,
        createdAt: new Date(), updatedAt: new Date()
      },
      {
        sessionId: 'sess_003', patientId: 'p3', patientName: 'Rohit Varma',
        workerId: 'w1', workerName: 'Rahul', date: new Date(),
        timeSlot: '01:00 PM', duration: 0, status: 'pending',
        therapies: [], notes: '', fee: 500,
        createdAt: new Date(), updatedAt: new Date()
      }
    ];
  }
}
