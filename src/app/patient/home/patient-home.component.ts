import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

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
export class PatientHomeComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly patientName = this.auth.userName;
  readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  });

  // Progress data (would come from Firestore)
  completedSessions = signal<number>(8);
  totalSessions = signal<number>(12);
  progressPercent = computed(() =>
    Math.round((this.completedSessions() / this.totalSessions()) * 100)
  );

  // Upcoming session
  nextSession = signal({
    date: 'Tomorrow',
    time: '10:00 AM',
    workerName: 'Rahul Sharma',
    workerSpecialization: 'BPT, 5 Years Exp.'
  });

  quickActions: QuickAction[] = [
    { id: 'home-visit', icon: '🏠', label: 'My Home', sublabel: 'Visit', route: '/patient/home', color: '#2196F3', bgColor: '#EFF6FF' },
    { id: 'track-sessions', icon: '📈', label: 'Track', sublabel: 'Sessions', route: '/patient/sessions', color: '#22C55E', bgColor: '#DCFCE7' },
    { id: 'payments', icon: '💳', label: 'Payments', sublabel: 'Razorpay', route: '/patient/payments', color: '#F4A62A', bgColor: '#FFF8E7' },
    { id: 'reports', icon: '📊', label: 'Reports', sublabel: 'Real-time', route: '/patient/home', color: '#EF4444', bgColor: '#FEE2E2' },
  ];

  navigate(route: string) {
    this.router.navigate([route]);
  }
}
