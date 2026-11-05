import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Firestore, collection, query, where, getDocs, onSnapshot, orderBy, limit, DocumentData } from '@angular/fire/firestore';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';
import { Session, calculateSessionEarning } from '../../core/models/session.model';
import { Transaction } from '../../core/models/transaction.model';

interface ActiveSubscription {
  subscriptionId: string;
  patientName: string;
  planName: string;
  price: number;
  remainingSessions: number;
  totalSessions: number;
  expiryDate: string;
}

interface PlanDistribution {
  name: string;
  icon: string;
  count: number;
  percent: number;
  color: string;
}

interface KpiCard {
  label: string;
  value: string | number;
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
  date: string;
  time: string;
  method: string;
  rawTimestamp?: number;
}

interface TopWorker {
  uid: string;
  name: string;
  sessions: number;
  earnings: number;
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
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
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

  // Real KPI Counts (live from Firestore)
  patientCount = signal<number>(0);
  workerCount = signal<number>(0);
  sessionCount = signal<number>(0);
  revenueTotal = signal<number>(0);

  // Real-time lists
  recentTransactions = signal<RecentTransaction[]>([]);
  topWorkers = signal<TopWorker[]>([]);
  activeSubscriptions = signal<ActiveSubscription[]>([]);
  planDistribution = signal<PlanDistribution[]>([]);

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

  kpis = computed<KpiCard[]>(() => [
    { label: 'Total Patients', value: this.patientCount().toString(), icon: '', growth: '', growthPositive: true, color: '#0284C7', bgColor: '#E0F2FE' },
    { label: 'Workers (Staff)', value: this.workerCount().toString(), icon: '', growth: '', growthPositive: true, color: '#0D9488', bgColor: '#CCFBF1' },
    { label: 'Sessions', value: this.sessionCount().toString(), icon: '', growth: '', growthPositive: true, color: '#D97706', bgColor: '#FEF3C7' },
    { label: 'Total Revenue', value: '₹' + this.revenueTotal().toLocaleString('en-IN'), icon: '', growth: '', growthPositive: true, color: '#16A34A', bgColor: '#DCFCE7' },
  ]);

  // Pre-computed donut segments
  donutSegments: DonutSegment[] = [];

  // Chart data (sample, can be replaced with real aggregated data)
  chartData = [
    { week: 'Week 1', thisMonth: 1200, lastMonth: 900 },
    { week: 'Week 2', thisMonth: 1800, lastMonth: 1400 },
    { week: 'Week 3', thisMonth: 2200, lastMonth: 1700 },
    { week: 'Week 4', thisMonth: 2800, lastMonth: 2100 },
  ];

  chartMax = 3000;

  private paymentData = [
    { label: 'UPI', percent: 60, color: '#0284C7' },
    { label: 'Card', percent: 25, color: '#0D9488' },
    { label: 'Cash', percent: 15, color: '#F59E0B' },
  ];

  get paymentMethods() { return this.paymentData; }

  ngOnInit() {
    this.buildDonutSegments();
    this.loadRealFirestoreData();
  }

  rawWorkers = signal<TopWorker[]>([]);
  workerStatsMap = signal<Record<string, { count: number; earnings: number }>>({});

  private updateTopWorkers(): void {
    const stats = this.workerStatsMap();
    const updated = this.rawWorkers().map(w => {
      const s = stats[w.uid] || (w.phone ? stats[w.phone] : null) || { count: w.sessions, earnings: w.earnings };
      return {
        ...w,
        sessions: Math.max(w.sessions, s.count),
        earnings: Math.max(w.earnings, s.earnings)
      };
    });
    this.topWorkers.set(updated.sort((a, b) => b.sessions - a.sessions));
  }

  // ─── Real Firestore Listener (KPIs + charts + lists) ──────────────────────────
  private loadRealFirestoreData(): void {
    // Listen to users collection for patient/worker counts
    const usersRef = collection(this.firestore, 'users');
    const usersUnsub = onSnapshot(usersRef, (snapshot) => {
      let patients = 0;
      const workers: TopWorker[] = [];

      snapshot.forEach(docSnap => {
        const u = docSnap.data() as User;
        if (u.role === 'patient') {
          patients++;
        } else if (u.role === 'worker') {
          workers.push({
            uid: docSnap.id,
            name: u.name,
            sessions: u.completedSessions || 0,
            earnings: Number(u.totalEarnings) || 0,
            initial: (u.name || 'W').charAt(0).toUpperCase(),
            phone: u.mobileNumber,
            specialization: u.specialization
          });
        }
      });

      this.patientCount.set(patients);
      this.workerCount.set(workers.length);
      this.rawWorkers.set(workers);
      this.updateTopWorkers();
    }, (err) => {
      console.warn('Users snapshot listener:', err);
    });

    // Listen to sessions collection for session count & worker stats
    const sessionsRef = collection(this.firestore, 'sessions');
    const sessionsUnsub = onSnapshot(sessionsRef, (snapshot) => {
      this.sessionCount.set(snapshot.size);

      const workerStats: Record<string, { count: number; earnings: number }> = {};
      snapshot.forEach(docSnap => {
        const s = docSnap.data() as Session;
        if (s.status === 'completed' && s.workerId) {
          if (!workerStats[s.workerId]) {
            workerStats[s.workerId] = { count: 0, earnings: 0 };
          }
          workerStats[s.workerId].count++;
          workerStats[s.workerId].earnings += calculateSessionEarning(s);
        }
      });
      this.workerStatsMap.set(workerStats);
      this.updateTopWorkers();
    }, (err) => {
      console.warn('Sessions snapshot listener:', err);
    });

    // Listen to transactions collection for revenue + recent transactions
    const transactionsRef = collection(this.firestore, 'transactions');
    const txnUnsub = onSnapshot(transactionsRef, (snapshot) => {
      let totalRevenue = 0;
      const txns: RecentTransaction[] = [];

      snapshot.forEach(docSnap => {
        const t = docSnap.data() as Transaction;
        if (t.status === 'Paid') {
          // If transaction is a plan session, patient already paid in plan purchase
          if (t.paymentMethod !== 'Subscription') {
            totalRevenue += Number(t.amount) || 0;
          }
        }
        const rawTimestamp = new Date(t.timestamp || t.sessionDate || 0).getTime();
        txns.push({
          patient: t.patientName || 'Patient',
          worker: t.workerName || 'Walk In Clinic',
          amount: `₹${t.amount || 0}`,
          status: (t.status === 'Paid' ? 'Paid' : 'Pending') as 'Paid' | 'Pending',
          date: new Date(t.timestamp || t.sessionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          time: new Date(t.timestamp || t.sessionDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          method: t.paymentMethod || 'UPI',
          rawTimestamp
        });
      });

      // Sort newest first by true timestamp
      txns.sort((a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0));

      this.revenueTotal.set(totalRevenue);
      this.recentTransactions.set(txns.filter(t => t.method !== 'Subscription').slice(0, 10));
    }, (err) => {
      console.warn('Transactions snapshot listener:', err);
    });

    // Store unsubscribers so they can be cleaned up if needed
    (this as any)._unsubs = [usersUnsub, sessionsUnsub, txnUnsub];

    // Listen to active subscriptions
    const subRef = collection(this.firestore, 'subscriptions');
    const subQuery = query(subRef, where('status', '==', 'active'));
    const subUnsub = onSnapshot(subQuery, (snapshot) => {
      const subs: ActiveSubscription[] = [];
      const planCounts: Record<string, { name: string; icon: string; count: number; color: string }> = {};

      snapshot.forEach(docSnap => {
        const s = docSnap.data() as any;
        subs.push({
          subscriptionId: s.subscriptionId || docSnap.id,
          patientName: s.patientName || 'Patient',
          planName: s.planName || 'Plan',
          price: s.price || 0,
          remainingSessions: s.remainingSessions || 0,
          totalSessions: s.totalSessions || 1,
          expiryDate: s.expiryDate || new Date().toISOString()
        });

        // Count plan distribution
        const planId = s.planId || 'unknown';
        if (!planCounts[planId]) {
          const planMeta: Record<string, { icon: string; color: string; name: string }> = {
            plan_weekly: { icon: '📅', color: '#2196F3', name: 'Weekly' },
            plan_biweekly: { icon: '⭐', color: '#1CB5E0', name: '15 Days' },
            plan_monthly: { icon: '🏆', color: '#F4A62A', name: 'Monthly' }
          };
          const meta = planMeta[planId] || { icon: '📋', color: '#94A3B8', name: s.planName || planId };
          planCounts[planId] = { name: meta.name, icon: meta.icon, count: 0, color: meta.color };
        }
        planCounts[planId].count++;
      });

      const total = subs.length || 1;
      const dist: PlanDistribution[] = Object.values(planCounts).map(p => ({
        ...p,
        percent: Math.round((p.count / total) * 100)
      }));

      this.activeSubscriptions.set(subs.sort((a, b) =>
        new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
      ));
      this.planDistribution.set(dist);
    }, (err) => {
      console.warn('Subscriptions snapshot listener:', err);
    });

    (this as any)._unsubs = [...((this as any)._unsubs || []), subUnsub];
  }

  getBarHeight(value: number): number {
    return (value / this.chartMax) * 100;
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
}
