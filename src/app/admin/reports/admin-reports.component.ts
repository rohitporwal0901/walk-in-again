import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, onSnapshot, Unsubscribe } from '@angular/fire/firestore';
import { Transaction } from '../../core/models/transaction.model';
import { Session, calculateSessionEarning } from '../../core/models/session.model';
import { User } from '../../core/models/user.model';

interface WorkerPerformance {
  name: string;
  sessions: number;
  earnings: number;
}

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="reports-admin-page animate-fade-in">
      <!-- Top Bar -->
      <header class="page-top-bar">
        <div>
          <h1 class="page-title">Analytics & Clinic Reports</h1>
          <p class="page-sub">Comprehensive clinical throughput, financial revenue breakdown, and staff productivity</p>
        </div>
        <div class="top-status-badge">
          <span class="live-dot"></span>
          <span>Live Analytics</span>
        </div>
      </header>

      <!-- KPI Summary Cards -->
      <section class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-icon-wrap icon-primary">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Total Net Revenue</span>
            <span class="kpi-value text-accent">₹{{ totalNetRevenue().toLocaleString('en-IN') }}</span>
            <span class="kpi-sub-text">Real clinic collection</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-wrap icon-plan">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 3h12l4 6-10 12L2 9z"></path>
            </svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Plan Revenue ({{ subscriptionShare() }}%)</span>
            <span class="kpi-value">₹{{ subscriptionRevenue().toLocaleString('en-IN') }}</span>
            <span class="kpi-sub-text">Package purchases</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-wrap icon-walkin">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <polyline points="17 11 19 13 23 9"></polyline>
            </svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Walk-In Revenue ({{ walkInShare() }}%)</span>
            <span class="kpi-value">₹{{ walkInRevenue().toLocaleString('en-IN') }}</span>
            <span class="kpi-sub-text">Direct collections</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-wrap icon-sessions">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Total Completed Sessions</span>
            <span class="kpi-value">{{ totalCompletedSessions() }}</span>
            <span class="kpi-sub-text">Delivered treatments</span>
          </div>
        </div>
      </section>

      <!-- Analytics Grid (Payment Modes & Revenue Distribution) -->
      <div class="analytics-split-grid">
        <!-- Payment Mode Breakdown -->
        <div class="report-card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Payment Mode Distribution</h3>
              <p class="card-sub">Channels through which patient payments were received</p>
            </div>
            <div class="card-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284C7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
              </svg>
            </div>
          </div>

          <div class="breakdown-list">
            <!-- UPI -->
            <div class="breakdown-item">
              <div class="b-head">
                <span class="b-lbl">UPI Online (Google Pay / PhonePe)</span>
                <span class="b-amt">₹{{ upiTotal().toLocaleString('en-IN') }} ({{ upiPercent() }}%)</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill fill-upi" [style.width.%]="upiPercent()"></div>
              </div>
            </div>

            <!-- Card -->
            <div class="breakdown-item">
              <div class="b-head">
                <span class="b-lbl">Debit / Credit Card</span>
                <span class="b-amt">₹{{ cardTotal().toLocaleString('en-IN') }} ({{ cardPercent() }}%)</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill fill-card" [style.width.%]="cardPercent()"></div>
              </div>
            </div>

            <!-- Cash -->
            <div class="breakdown-item">
              <div class="b-head">
                <span class="b-lbl">Cash Counter Collection</span>
                <span class="b-amt">₹{{ cashTotal().toLocaleString('en-IN') }} ({{ cashPercent() }}%)</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill fill-cash" [style.width.%]="cashPercent()"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Session Coverage Split -->
        <div class="report-card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Session Delivery Mix</h3>
              <p class="card-sub">Ratio of subscription plan vs walk-in sessions</p>
            </div>
            <div class="card-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284C7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </div>
          </div>

          <div class="metric-stats-box">
            <div class="stat-bubble">
              <span class="bubble-val">{{ planSessionsCount() }}</span>
              <span class="bubble-lbl">Plan Covered Sessions</span>
            </div>
            <div class="stat-bubble">
              <span class="bubble-val">{{ walkInSessionsCount() }}</span>
              <span class="bubble-lbl">Direct Walk-Ins</span>
            </div>
          </div>

          <div class="stacked-bar-wrap">
            <div class="stacked-bar">
              <div class="stack-seg seg-plan" [style.width.%]="planSessionPercent()" [title]="'Plan: ' + planSessionPercent() + '%'"></div>
              <div class="stack-seg seg-walkin" [style.width.%]="walkInSessionPercent()" [title]="'Walk-in: ' + walkInSessionPercent() + '%'"></div>
            </div>
            <div class="stacked-legend">
              <span class="legend-item"><span class="dot dot-plan"></span> Subscription ({{ planSessionPercent() }}%)</span>
              <span class="legend-item"><span class="dot dot-walkin"></span> Walk-In ({{ walkInSessionPercent() }}%)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Physiotherapist Performance & Payout Summary Table -->
      <div class="table-container-card">
        <div class="table-top-bar">
          <div>
            <h3 class="card-title">Physiotherapist Productivity & Earnings</h3>
            <p class="card-sub">Clinical sessions delivered by each physiotherapist and their earned share</p>
          </div>
        </div>

        <div class="table-responsive">
          <table class="report-table">
            <thead>
              <tr>
                <th>Physiotherapist</th>
                <th>Sessions Completed</th>
                <th>Total Earned (₹)</th>
                <th>Avg / Session</th>
                <th>Productivity</th>
              </tr>
            </thead>
            <tbody>
              @for (w of workerPerformances(); track w.name) {
                <tr>
                  <td>
                    <div class="physio-cell">
                      <div class="physio-avatar">{{ w.name.charAt(0) }}</div>
                      <strong>{{ w.name }}</strong>
                    </div>
                  </td>
                  <td>
                    <span class="sess-pill">{{ w.sessions }} Sessions</span>
                  </td>
                  <td>
                    <strong class="earnings-val">₹{{ w.earnings.toLocaleString('en-IN') }}</strong>
                  </td>
                  <td>
                    <span class="avg-val">₹{{ w.sessions > 0 ? Math.round(w.earnings / w.sessions) : 0 }}</span>
                  </td>
                  <td>
                    <div class="progress-inline">
                      <div class="progress-track" style="height: 6px; width: 120px;">
                        <div class="progress-fill fill-upi" [style.width.%]="maxWorkerSessions() > 0 ? (w.sessions / maxWorkerSessions()) * 100 : 0"></div>
                      </div>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" style="text-align: center; padding: 32px; color: #64748B;">
                    No physiotherapist sessions recorded yet.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .reports-admin-page { padding: 0; }
    .page-top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 14px; }
    .page-title { font-size: 22px; font-weight: 800; color: #0F172A; margin: 0 0 4px; letter-spacing: -0.02em; }
    .page-sub { font-size: 13px; color: #64748B; margin: 0; }
    .top-status-badge { display: inline-flex; align-items: center; gap: 6px; background: #DCFCE7; color: #166534; padding: 6px 12px; border-radius: 999px; font-size: 11.5px; font-weight: 700; border: 1px solid #BBF7D0; }
    .live-dot { width: 7px; height: 7px; border-radius: 50%; background: #16A34A; animation: pulse 1.5s infinite; }

    // KPI Cards
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 20px; }
    .kpi-card { background: #FFFFFF; border-radius: 18px; padding: 18px 20px; display: flex; align-items: flex-start; gap: 14px; box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03); border: 1px solid rgba(226, 232, 240, 0.85); transition: transform 0.15s ease, box-shadow 0.15s ease; min-height: 88px; box-sizing: border-box; }
    .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(15, 23, 42, 0.06); }
    .kpi-icon-wrap { width: 46px; height: 46px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .kpi-icon-wrap svg { width: 22px; height: 22px; }
    .kpi-icon-wrap.icon-primary { background: #E0F2FE; color: #0284C7; border: 1px solid #BAE6FD; }
    .kpi-icon-wrap.icon-plan { background: #EDE9FE; color: #7C3AED; border: 1px solid #DDD6FE; }
    .kpi-icon-wrap.icon-walkin { background: #DCFCE7; color: #0D9488; border: 1px solid #A7F3D0; }
    .kpi-icon-wrap.icon-sessions { background: #FEF3C7; color: #D97706; border: 1px solid #FDE68A; }
    .kpi-content { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .kpi-label { font-size: 11.5px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.04em; line-height: 1.25; }
    .kpi-value { font-size: 24px; font-weight: 800; color: #0F172A; line-height: 1.15; letter-spacing: -0.02em; }
    .kpi-value.text-accent { color: #0284C7; }
    .kpi-sub-text { font-size: 11.5px; color: #94A3B8; font-weight: 500; margin-top: 2px; }

    // Analytics Split Grid
    .analytics-split-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-bottom: 20px; }
    .report-card { background: #FFFFFF; border-radius: 18px; padding: 22px; box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03); border: 1px solid rgba(226, 232, 240, 0.85); display: flex; flex-direction: column; gap: 16px; }
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .card-title { font-size: 15px; font-weight: 800; color: #0F172A; margin: 0 0 3px; }
    .card-sub { font-size: 12.5px; color: #64748B; margin: 0; }
    .card-icon-wrap { width: 38px; height: 38px; border-radius: 12px; background: #E0F2FE; color: #0284C7; display: flex; align-items: center; justify-content: center; }

    // Breakdown
    .breakdown-list { display: flex; flex-direction: column; gap: 14px; }
    .breakdown-item { display: flex; flex-direction: column; gap: 6px; }
    .b-head { display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 600; color: #1E293B; }
    .b-lbl { color: #334155; }
    .b-amt { color: #0F172A; font-weight: 700; }
    .progress-track { width: 100%; height: 7px; background: #F1F5F9; border-radius: 999px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 999px; transition: width 0.3s ease; }
    .fill-upi { background: linear-gradient(90deg, #8B5CF6, #6D28D9); }
    .fill-card { background: linear-gradient(90deg, #0284C7, #0D9488); }
    .fill-cash { background: linear-gradient(90deg, #10B981, #059669); }

    // Delivery Mix
    .metric-stats-box { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .stat-bubble { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; padding: 16px; display: flex; flex-direction: column; align-items: center; text-align: center; }
    .bubble-val { font-size: 22px; font-weight: 800; color: #0F172A; margin-bottom: 3px; }
    .bubble-lbl { font-size: 11.5px; font-weight: 600; color: #64748B; }

    .stacked-bar-wrap { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
    .stacked-bar { height: 10px; width: 100%; border-radius: 999px; overflow: hidden; display: flex; background: #F1F5F9; }
    .stack-seg { height: 100%; }
    .seg-plan { background: #0284C7; }
    .seg-walkin { background: #10B981; }
    .stacked-legend { display: flex; gap: 16px; font-size: 12px; font-weight: 600; color: #475569; }
    .legend-item { display: flex; align-items: center; gap: 6px; }
    .legend-item .dot { width: 9px; height: 9px; border-radius: 50%; }
    .dot-plan { background: #0284C7; }
    .dot-walkin { background: #10B981; }

    // Table
    .table-container-card { background: #FFFFFF; border-radius: 18px; box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03); border: 1px solid rgba(226, 232, 240, 0.85); overflow: hidden; }
    .table-top-bar { padding: 16px 20px; border-bottom: 1px solid #F1F5F9; }
    .table-responsive { overflow-x: auto; }
    .report-table { width: 100%; border-collapse: collapse; text-align: left; }
    .report-table thead tr { background: #F8FAFC; border-bottom: 1.5px solid #E2E8F0; }
    .report-table th { padding: 13px 18px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748B; letter-spacing: 0.04em; white-space: nowrap; }
    .report-table tbody tr { border-bottom: 1px solid #F1F5F9; transition: background 0.15s ease; }
    .report-table tbody tr:hover { background: #F8FAFC; }
    .report-table td { padding: 13px 18px; font-size: 13px; color: #1E293B; vertical-align: middle; }

    .physio-cell { display: flex; align-items: center; gap: 10px; }
    .physio-avatar { width: 32px; height: 32px; border-radius: 10px; background: linear-gradient(135deg, #0284C7 0%, #0D9488 100%); color: white; display: flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 700; }
    .sess-pill { background: #E0F2FE; color: #0369A1; padding: 4px 10px; border-radius: 8px; font-size: 11.5px; font-weight: 700; border: 1px solid #BAE6FD; }
    .earnings-val { font-size: 14px; font-weight: 800; color: #0D9488; }
    .avg-val { font-size: 13px; font-weight: 600; color: #475569; }

    @keyframes pulse { 0% { transform: scale(0.95); opacity: 0.8; } 50% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(0.95); opacity: 0.8; } }
  `]
})
export class AdminReportsComponent implements OnInit, OnDestroy {
  protected readonly Math = Math;
  private firestore = inject(Firestore);

  private txnsUnsub: Unsubscribe | null = null;
  private sessionsUnsub: Unsubscribe | null = null;
  private workersUnsub: Unsubscribe | null = null;

  transactions = signal<Transaction[]>([]);
  sessions = signal<Session[]>([]);
  workers = signal<User[]>([]);

  ngOnInit() {
    this.listenData();
  }

  ngOnDestroy() {
    if (this.txnsUnsub) this.txnsUnsub();
    if (this.sessionsUnsub) this.sessionsUnsub();
    if (this.workersUnsub) this.workersUnsub();
  }

  private listenData() {
    this.txnsUnsub = onSnapshot(collection(this.firestore, 'transactions'), (snap) => {
      const list: Transaction[] = [];
      snap.forEach(d => list.push(d.data() as Transaction));
      this.transactions.set(list);
    });

    this.sessionsUnsub = onSnapshot(collection(this.firestore, 'sessions'), (snap) => {
      const list: Session[] = [];
      snap.forEach(d => list.push(d.data() as Session));
      this.sessions.set(list);
    });

    this.workersUnsub = onSnapshot(collection(this.firestore, 'users'), (snap) => {
      const list: User[] = [];
      snap.forEach(d => {
        const u = d.data() as User;
        if (u.role === 'worker') list.push(u);
      });
      this.workers.set(list);
    });
  }

  // Double-counting prevention
  totalNetRevenue = computed(() =>
    this.transactions()
      .filter(t => t.paymentMethod !== 'Subscription')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  );

  subscriptionRevenue = computed(() =>
    this.transactions()
      .filter(t => (t.type === 'subscription' || t.planName) && t.paymentMethod !== 'Subscription')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  );

  walkInRevenue = computed(() =>
    this.transactions()
      .filter(t => t.type !== 'subscription' && !t.planName && t.paymentMethod !== 'Subscription')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  );

  subscriptionShare = computed(() => {
    const tot = this.totalNetRevenue();
    return tot > 0 ? Math.round((this.subscriptionRevenue() / tot) * 100) : 0;
  });

  walkInShare = computed(() => {
    const tot = this.totalNetRevenue();
    return tot > 0 ? Math.round((this.walkInRevenue() / tot) * 100) : 0;
  });

  totalCompletedSessions = computed(() =>
    this.sessions().filter(s => s.status === 'completed').length
  );

  // Payment Breakdown
  upiTotal = computed(() =>
    this.transactions().filter(t => t.paymentMethod === 'UPI').reduce((s, t) => s + (Number(t.amount) || 0), 0)
  );
  cardTotal = computed(() =>
    this.transactions().filter(t => t.paymentMethod === 'Card').reduce((s, t) => s + (Number(t.amount) || 0), 0)
  );
  cashTotal = computed(() =>
    this.transactions().filter(t => t.paymentMethod === 'Cash').reduce((s, t) => s + (Number(t.amount) || 0), 0)
  );

  upiPercent = computed(() => {
    const tot = this.totalNetRevenue();
    return tot > 0 ? Math.round((this.upiTotal() / tot) * 100) : 0;
  });
  cardPercent = computed(() => {
    const tot = this.totalNetRevenue();
    return tot > 0 ? Math.round((this.cardTotal() / tot) * 100) : 0;
  });
  cashPercent = computed(() => {
    const tot = this.totalNetRevenue();
    return tot > 0 ? Math.round((this.cashTotal() / tot) * 100) : 0;
  });

  // Sessions Breakdown
  planSessionsCount = computed(() =>
    this.sessions().filter(s => s.status === 'completed' && s.isCoveredBySubscription).length
  );
  walkInSessionsCount = computed(() =>
    this.sessions().filter(s => s.status === 'completed' && !s.isCoveredBySubscription).length
  );
  planSessionPercent = computed(() => {
    const tot = this.totalCompletedSessions();
    return tot > 0 ? Math.round((this.planSessionsCount() / tot) * 100) : 50;
  });
  walkInSessionPercent = computed(() => {
    const tot = this.totalCompletedSessions();
    return tot > 0 ? Math.round((this.walkInSessionsCount() / tot) * 100) : 50;
  });

  // Worker Performances
  workerPerformances = computed<WorkerPerformance[]>(() => {
    const map: Record<string, WorkerPerformance> = {};

    // Initialize with registered staff
    this.workers().forEach(w => {
      map[w.name] = { name: w.name, sessions: 0, earnings: 0 };
    });

    // Accumulate from completed sessions
    this.sessions().forEach(s => {
      if (s.status === 'completed' && s.workerName) {
        if (!map[s.workerName]) {
          map[s.workerName] = { name: s.workerName, sessions: 0, earnings: 0 };
        }
        map[s.workerName].sessions++;
        const earn = s.sessionValue !== undefined && s.sessionValue !== null
          ? Number(s.sessionValue)
          : calculateSessionEarning(s);
        map[s.workerName].earnings += earn;
      }
    });

    return Object.values(map).sort((a, b) => b.sessions - a.sessions);
  });

  maxWorkerSessions = computed(() => {
    const list = this.workerPerformances();
    return list.length ? Math.max(...list.map(w => w.sessions)) : 1;
  });
}
