import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Firestore, collection, query, where, getDocs, onSnapshot } from '@angular/fire/firestore';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';

interface KpiCard {
  label: string;
  value: string;
  icon: string;
  growth: string;
  growthPositive: boolean;
  color: string;
  bgColor: string;
}

interface RecentTransaction {
  patient: string;
  worker: string;
  amount: string;
  status: 'Paid' | 'Pending';
}

interface TopWorker {
  name: string;
  sessions: number;
  initial: string;
  phone?: string;
  specialization?: string;
}

interface DonutSegment {
  label: string;
  percent: number;
  color: string;
  dashArray: string;
  dashOffset: number;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  selectedPeriod = signal<'Week' | 'Month'>('Month');
  showAddWorkerModal = signal<boolean>(false);
  isSubmittingWorker = signal<boolean>(false);
  workerModalError = signal<string>('');
  workerModalSuccess = signal<string>('');

  // Real Counts
  patientCount = signal<number>(0);
  workerCount = signal<number>(0);
  sessionCount = signal<number>(0);
  revenueTotal = signal<number>(0);

  // Workers List from Firestore
  topWorkers = signal<TopWorker[]>([]);

  // Add Worker Form (Admin registers worker)
  workerForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    specialization: ['Orthopedic Physiotherapy', [Validators.required]],
    experience: ['3 Years', [Validators.required]],
    pin: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]]
  });

  specializations = [
    'Orthopedic Physiotherapy',
    'Sports Rehabilitation',
    'Neurological PT',
    'Cardiopulmonary Rehab',
    'Pediatric Physiotherapy',
    'Geriatric Physiotherapy'
  ];

  kpis: KpiCard[] = [
    { label: 'Total Patients', value: '0', icon: '👥', growth: '+100%', growthPositive: true, color: '#2196F3', bgColor: '#EFF6FF' },
    { label: 'Workers (Staff)', value: '0', icon: '👨‍⚕️', growth: '+100%', growthPositive: true, color: '#22C55E', bgColor: '#DCFCE7' },
    { label: 'Sessions', value: '0', icon: '📋', growth: '+18%', growthPositive: true, color: '#F4A62A', bgColor: '#FFF8E7' },
    { label: 'Total Revenue', value: '₹0', icon: '💰', growth: '+20%', growthPositive: true, color: '#EF4444', bgColor: '#FEE2E2' },
  ];

  recentTransactions: RecentTransaction[] = [];

  // Pre-computed donut segments
  donutSegments: DonutSegment[] = [];

  // Chart data
  chartData = [
    { week: 'Week 1', thisMonth: 1200, lastMonth: 900 },
    { week: 'Week 2', thisMonth: 1800, lastMonth: 1400 },
    { week: 'Week 3', thisMonth: 2200, lastMonth: 1700 },
    { week: 'Week 4', thisMonth: 2800, lastMonth: 2100 },
  ];

  chartMax = 3000;

  private paymentData = [
    { label: 'UPI', percent: 60, color: '#2196F3' },
    { label: 'Card', percent: 25, color: '#22C55E' },
    { label: 'Cash', percent: 15, color: '#F59E0B' },
  ];

  get paymentMethods() { return this.paymentData; }

  ngOnInit() {
    this.buildDonutSegments();
    this.loadRealFirestoreData();
  }

  // ─── Real Firestore Listener ────────────────────────────────────────────────
  private loadRealFirestoreData(): void {
    const usersRef = collection(this.firestore, 'users');

    // Live listener for users collection
    onSnapshot(usersRef, (snapshot) => {
      let patients = 0;
      const workers: TopWorker[] = [];

      snapshot.forEach(docSnap => {
        const u = docSnap.data() as User;
        if (u.role === 'patient') {
          patients++;
        } else if (u.role === 'worker') {
          workers.push({
            name: u.name,
            sessions: u.completedSessions || 0,
            initial: (u.name || 'W').charAt(0).toUpperCase(),
            phone: u.mobileNumber,
            specialization: u.specialization
          });
        }
      });

      this.patientCount.set(patients);
      this.workerCount.set(workers.length);
      this.topWorkers.set(workers);

      // Update KPI Cards
      this.kpis[0].value = patients.toString();
      this.kpis[1].value = workers.length.toString();
    }, (err) => {
      console.warn('Realtime snapshot listener note:', err);
    });
  }

  // ─── Add Worker (Admin registers worker) ─────────────────────────────────────
  openAddWorkerModal() {
    this.workerModalError.set('');
    this.workerModalSuccess.set('');
    this.workerForm.reset({
      name: '',
      phone: '',
      specialization: 'Orthopedic Physiotherapy',
      experience: '3 Years',
      pin: '1234'
    });
    this.showAddWorkerModal.set(true);
  }

  closeAddWorkerModal() {
    this.showAddWorkerModal.set(false);
  }

  async submitNewWorker() {
    if (this.workerForm.invalid) {
      this.workerForm.markAllAsTouched();
      return;
    }

    const { name, phone, specialization, experience, pin } = this.workerForm.value;
    this.isSubmittingWorker.set(true);
    this.workerModalError.set('');
    this.workerModalSuccess.set('');

    try {
      await this.authService.createWorkerFromAdmin({
        name,
        phone,
        pin,
        specialization,
        experience
      });

      this.isSubmittingWorker.set(false);
      this.workerModalSuccess.set(`Worker "${name}" successfully registered! They can now login with +91 ${phone} and M-PIN ${pin}.`);

      setTimeout(() => {
        this.closeAddWorkerModal();
      }, 2000);
    } catch (e: any) {
      this.isSubmittingWorker.set(false);
      this.workerModalError.set(e.message || 'Failed to create worker account. Please try again.');
    }
  }

  private buildDonutSegments(): void {
    const circumference = 2 * Math.PI * 45;
    let accumulated = 0;
    this.donutSegments = this.paymentData.map(method => {
      const dash = (method.percent / 100) * circumference;
      const offset = -(accumulated / 100) * circumference + circumference / 4;
      accumulated += method.percent;
      return {
        label: method.label,
        percent: method.percent,
        color: method.color,
        dashArray: `${dash} ${circumference - dash}`,
        dashOffset: offset
      };
    });
  }

  getBarHeight(value: number): number {
    return (value / this.chartMax) * 100;
  }
}
