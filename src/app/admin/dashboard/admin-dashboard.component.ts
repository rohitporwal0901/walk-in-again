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
  protected readonly Math = Math;
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
    { label: 'Total Patients', value: this.patientCount().toString(), icon: '', growth: '', growthPositive: true, color: '#FFFFFF', bgColor: 'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)' },
    { label: 'Workers (Staff)', value: this.workerCount().toString(), icon: '', growth: '', growthPositive: true, color: '#FFFFFF', bgColor: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' },
    { label: 'Sessions', value: this.sessionCount().toString(), icon: '', growth: '', growthPositive: true, color: '#FFFFFF', bgColor: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)' },
    { label: 'Total Revenue', value: '₹' + this.revenueTotal().toLocaleString('en-IN'), icon: '', growth: '', growthPositive: true, color: '#FFFFFF', bgColor: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)' },
  ]);

  // Raw Transactions from Firestore for real-time charts & calculations
  rawTransactions = signal<Transaction[]>([]);

  // ─── Real Payment Methods (Donut Chart) ──────────────────────────────────────
  upiAmount = computed(() =>
    this.rawTransactions()
      .filter(t => t.status === 'Paid' && t.paymentMethod === 'UPI')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  );

  cardAmount = computed(() =>
    this.rawTransactions()
      .filter(t => t.status === 'Paid' && t.paymentMethod === 'Card')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  );

  cashAmount = computed(() =>
    this.rawTransactions()
      .filter(t => t.status === 'Paid' && t.paymentMethod === 'Cash')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  );

  paymentMethods = computed(() => {
    const upi = this.upiAmount();
    const card = this.cardAmount();
    const cash = this.cashAmount();
    const total = upi + card + cash;

    if (total > 0) {
      const upiPct = Math.round((upi / total) * 100);
      const cardPct = Math.round((card / total) * 100);
      const cashPct = Math.max(0, 100 - upiPct - cardPct);
      return [
        { label: 'UPI', percent: upiPct, amount: upi, color: '#0284C7' },
        { label: 'Card', percent: cardPct, amount: card, color: '#0D9488' },
        { label: 'Cash', percent: cashPct, amount: cash, color: '#F59E0B' },
      ];
    }

    const txns = this.rawTransactions().filter(t => t.paymentMethod !== 'Subscription');
    const totalCount = txns.length;
    if (totalCount > 0) {
      const upiCnt = txns.filter(t => t.paymentMethod === 'UPI').length;
      const cardCnt = txns.filter(t => t.paymentMethod === 'Card').length;
      const cashCnt = txns.filter(t => t.paymentMethod === 'Cash').length;
      const upiPct = Math.round((upiCnt / totalCount) * 100);
      const cardPct = Math.round((cardCnt / totalCount) * 100);
      const cashPct = Math.max(0, 100 - upiPct - cardPct);
      return [
        { label: 'UPI', percent: upiPct, amount: 0, color: '#0284C7' },
        { label: 'Card', percent: cardPct, amount: 0, color: '#0D9488' },
        { label: 'Cash', percent: cashPct, amount: 0, color: '#F59E0B' },
      ];
    }

    return [
      { label: 'UPI', percent: 0, amount: 0, color: '#0284C7' },
      { label: 'Card', percent: 0, amount: 0, color: '#0D9488' },
      { label: 'Cash', percent: 0, amount: 0, color: '#F59E0B' },
    ];
  });

  dominantPayment = computed(() => {
    const methods = this.paymentMethods();
    const sorted = [...methods].sort((a, b) => b.percent - a.percent);
    return sorted[0] || { label: 'UPI', percent: 0 };
  });

  donutSegments = computed<DonutSegment[]>(() => {
    const methods = this.paymentMethods();
    const circumference = 2 * Math.PI * 45; // ~282.74
    const active = methods.filter(m => m.percent > 0);

    if (active.length === 0) {
      return [{
        label: 'No Data',
        percent: 0,
        color: '#E2E8F0',
        dashArray: `${circumference} 0`,
        dashOffset: 0
      }];
    }

    let accumulated = 0;
    return active.map(m => {
      const dash = (m.percent / 100) * circumference;
      const offset = -(accumulated / 100) * circumference + circumference / 4;
      accumulated += m.percent;
      return {
        label: m.label,
        percent: m.percent,
        color: m.color,
        dashArray: `${dash} ${circumference - dash}`,
        dashOffset: offset
      };
    });
  });

  // ─── Real Revenue Overview (Bar Chart) ──────────────────────────────────────
  chartData = computed(() => {
    const txns = this.rawTransactions().filter(t => t.status === 'Paid' && t.paymentMethod !== 'Subscription');
    const period = this.selectedPeriod();
    const now = new Date();

    if (period === 'Month') {
      const cYear = now.getFullYear();
      const cMonth = now.getMonth();
      const pYear = cMonth === 0 ? cYear - 1 : cYear;
      const pMonth = cMonth === 0 ? 11 : cMonth - 1;

      const currentWeeks = [0, 0, 0, 0];
      const prevWeeks = [0, 0, 0, 0];

      txns.forEach(t => {
        const d = new Date(t.timestamp || t.sessionDate || 0);
        if (isNaN(d.getTime())) return;
        const amt = Number(t.amount) || 0;
        const day = d.getDate();
        const wIdx = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;

        if (d.getFullYear() === cYear && d.getMonth() === cMonth) {
          currentWeeks[wIdx] += amt;
        } else if (d.getFullYear() === pYear && d.getMonth() === pMonth) {
          prevWeeks[wIdx] += amt;
        }
      });

      return [
        { week: 'Week 1', thisMonth: currentWeeks[0], lastMonth: prevWeeks[0] },
        { week: 'Week 2', thisMonth: currentWeeks[1], lastMonth: prevWeeks[1] },
        { week: 'Week 3', thisMonth: currentWeeks[2], lastMonth: prevWeeks[2] },
        { week: 'Week 4', thisMonth: currentWeeks[3], lastMonth: prevWeeks[3] },
      ];
    } else {
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0
      const thisMon = new Date(now);
      thisMon.setDate(now.getDate() - dayOfWeek);
      thisMon.setHours(0, 0, 0, 0);

      const lastMon = new Date(thisMon);
      lastMon.setDate(lastMon.getDate() - 7);

      const nextMon = new Date(thisMon);
      nextMon.setDate(nextMon.getDate() + 7);

      const currentDays = [0, 0, 0, 0, 0, 0, 0];
      const prevDays = [0, 0, 0, 0, 0, 0, 0];

      txns.forEach(t => {
        const d = new Date(t.timestamp || t.sessionDate || 0);
        if (isNaN(d.getTime())) return;
        const amt = Number(t.amount) || 0;
        const tTime = d.getTime();

        if (tTime >= thisMon.getTime() && tTime < nextMon.getTime()) {
          const idx = (d.getDay() + 6) % 7;
          currentDays[idx] += amt;
        } else if (tTime >= lastMon.getTime() && tTime < thisMon.getTime()) {
          const idx = (d.getDay() + 6) % 7;
          prevDays[idx] += amt;
        }
      });

      return dayNames.map((name, i) => ({
        week: name,
        thisMonth: currentDays[i],
        lastMonth: prevDays[i]
      }));
    }
  });

  chartMax = computed(() => {
    const data = this.chartData();
    const maxVal = Math.max(...data.map(d => Math.max(d.thisMonth, d.lastMonth)), 0);
    if (maxVal === 0) return 2000;
    return Math.ceil((maxVal * 1.25) / 500) * 500;
  });

  avgWeeklyRevenue = computed(() => {
    const data = this.chartData();
    const total = data.reduce((sum, d) => sum + d.thisMonth, 0);
    return data.length > 0 ? Math.round(total / data.length) : 0;
  });

  peakPerformance = computed(() => {
    const data = this.chartData();
    if (!data.length) return 'None (₹0)';
    let peak = data[0];
    for (const d of data) {
      if (d.thisMonth > peak.thisMonth) peak = d;
    }
    return peak.thisMonth > 0 ? `${peak.week} (₹${peak.thisMonth.toLocaleString('en-IN')})` : 'None (₹0)';
  });

  growthRate = computed(() => {
    const data = this.chartData();
    const curTotal = data.reduce((sum, d) => sum + d.thisMonth, 0);
    const prevTotal = data.reduce((sum, d) => sum + d.lastMonth, 0);
    const suffix = this.selectedPeriod() === 'Month' ? 'MoM' : 'WoW';

    if (prevTotal > 0) {
      const g = Math.round(((curTotal - prevTotal) / prevTotal) * 100);
      return `${g >= 0 ? '+' : ''}${g}% ${suffix}`;
    }
    if (curTotal > 0) {
      return `+100% ${suffix}`;
    }
    return `0% ${suffix}`;
  });

  ngOnInit() {
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
      const rawTxnList: Transaction[] = [];

      snapshot.forEach(docSnap => {
        const t = docSnap.data() as Transaction;
        rawTxnList.push(t);
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
          amount: `₹${(Number(t.amount) || 0).toLocaleString('en-IN')}`,
          status: (t.status === 'Paid' ? 'Paid' : 'Pending') as 'Paid' | 'Pending',
          date: new Date(t.timestamp || t.sessionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          time: new Date(t.timestamp || t.sessionDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          method: t.paymentMethod || 'UPI',
          rawTimestamp
        });
      });

      // Sort newest first by true timestamp
      txns.sort((a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0));

      this.rawTransactions.set(rawTxnList);
      this.revenueTotal.set(totalRevenue);
      this.recentTransactions.set(txns.filter(t => t.method !== 'Subscription'));
    }, (err) => {
      console.warn('Transactions snapshot listener:', err);
    });

    // Store unsubscribers so they can be cleaned up if needed
    (this as any)._unsubs = [usersUnsub, sessionsUnsub, txnUnsub];

    // Listen to active subscriptions
    const subRef = collection(this.firestore, 'subscriptions');
    const subUnsub = onSnapshot(subRef, (snapshot) => {
      const subs: ActiveSubscription[] = [];
      const planCounts: Record<string, { name: string; icon: string; count: number; color: string }> = {};

      snapshot.forEach(docSnap => {
        const s = docSnap.data() as any;
        const status = (s.status || 'active').toLowerCase();
        if (status === 'active' || (s.remainingSessions && Number(s.remainingSessions) > 0)) {
          const planName = s.planName || 'Therapy Plan';
          subs.push({
            subscriptionId: s.subscriptionId || docSnap.id,
            patientName: s.patientName || 'Patient',
            planName: planName,
            price: Number(s.price) || 0,
            remainingSessions: s.remainingSessions !== undefined ? Number(s.remainingSessions) : 1,
            totalSessions: Number(s.totalSessions) || 1,
            expiryDate: s.expiryDate || new Date().toISOString()
          });

          // Group by plan type
          const pLower = planName.toLowerCase();
          let pCategory = 'Weekly';
          let pColor = '#0284C7';
          if (pLower.includes('month') || pLower.includes('30')) {
            pCategory = 'Monthly';
            pColor = '#F59E0B';
          } else if (pLower.includes('15') || pLower.includes('biweekly')) {
            pCategory = '15 Days';
            pColor = '#0D9488';
          }

          if (!planCounts[pCategory]) {
            planCounts[pCategory] = { name: pCategory, icon: '📦', count: 0, color: pColor };
          }
          planCounts[pCategory].count++;
        }
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
    const max = this.chartMax();
    if (!value || value <= 0 || max <= 0) return 0;
    const pct = (value / max) * 100;
    return Math.min(Math.max(pct, 5), 100);
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
