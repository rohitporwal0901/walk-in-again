import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, onSnapshot, Unsubscribe } from '@angular/fire/firestore';
import { Transaction, PaymentMethod, PaymentStatus } from '../../core/models/transaction.model';

interface FormattedTransaction {
  id: string;
  patientName: string;
  patientMobile: string;
  workerName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  type: string;
  description: string;
  planName?: string;
  dateStr: string;
  timeStr: string;
  rawTimestamp: number;
}

@Component({
  selector: 'app-admin-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="transactions-admin-page animate-fade-in">
      <!-- Top Bar -->
      <header class="page-top-bar">
        <div>
          <h1 class="page-title">Financial Transactions</h1>
          <p class="page-sub">Track all clinic receipts, UPI/Card payments, and subscription purchases in real-time</p>
        </div>
        <div class="top-status-badge">
          <span class="live-dot"></span>
          <span>Live Ledger Sync</span>
        </div>
      </header>

      <!-- KPI Summary Cards -->
      <section class="kpi-grid">
        <div class="kpi-card highlight-card">
          <div class="kpi-icon-wrap" style="background: rgba(255,255,255,0.2); color: white;">💰</div>
          <div class="kpi-content">
            <span class="kpi-label" style="color: rgba(255,255,255,0.8);">Total Net Revenue</span>
            <span class="kpi-value" style="color: white;">₹{{ totalNetRevenue().toLocaleString('en-IN') }}</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-wrap" style="background: #EFF6FF; color: #2563EB;">💎</div>
          <div class="kpi-content">
            <span class="kpi-label">Plan Purchases</span>
            <span class="kpi-value">₹{{ subscriptionRevenue().toLocaleString('en-IN') }}</span>
            <span class="kpi-sub-text">{{ subscriptionTxnCount() }} plans sold</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-wrap" style="background: #DCFCE7; color: #16A34A;">🚶</div>
          <div class="kpi-content">
            <span class="kpi-label">Walk-In Revenue</span>
            <span class="kpi-value">₹{{ walkInRevenue().toLocaleString('en-IN') }}</span>
            <span class="kpi-sub-text">{{ walkInTxnCount() }} direct payments</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-wrap" style="background: #FEF3C7; color: #D97706;">💳</div>
          <div class="kpi-content">
            <span class="kpi-label">Total Transactions</span>
            <span class="kpi-value">{{ transactions().length }}</span>
            <span class="kpi-sub-text">Avg: ₹{{ averageTxnValue() }}</span>
          </div>
        </div>
      </section>

      <!-- Search & Filters -->
      <div class="controls-panel">
        <div class="search-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="search"
            placeholder="Search transaction ID, patient name, mobile..."
            [value]="searchQuery()"
            (input)="searchQuery.set($any($event.target).value)"
            class="search-input"
            id="txn-search-input"
          />
        </div>

        <div class="filter-group">
          <span class="filter-lbl">Payment Mode:</span>
          @for (m of ['All', 'UPI', 'Card', 'Cash', 'Subscription']; track m) {
            <button
              type="button"
              class="filter-pill"
              [class.active]="selectedMethod() === m"
              (click)="selectedMethod.set(m)"
            >
              {{ m }}
            </button>
          }
        </div>
      </div>

      <!-- Transactions Table -->
      <div class="table-container-card">
        @if (isLoading()) {
          <div class="loading-state">
            <div class="spinner-ring"></div>
            <p>Fetching clinic transactions...</p>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="txns-table">
              <thead>
                <tr>
                  <th>Transaction ID & Time</th>
                  <th>Patient</th>
                  <th>Description / Type</th>
                  <th>Amount</th>
                  <th>Payment Method</th>
                  <th>Staff / Physio</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (txn of filteredTransactions(); track txn.id) {
                  <tr class="table-row" [id]="'txn-row-' + txn.id">
                    <!-- Txn ID & Time -->
                    <td class="col-id">
                      <div class="id-cell">
                        <strong class="txn-id">#{{ txn.id.slice(0, 9) }}</strong>
                        <span class="txn-date">{{ txn.dateStr }} • {{ txn.timeStr }}</span>
                      </div>
                    </td>

                    <!-- Patient -->
                    <td class="col-patient">
                      <div class="patient-cell">
                        <div class="patient-avatar">
                          {{ (txn.patientName || 'P').charAt(0).toUpperCase() }}
                        </div>
                        <div class="patient-info">
                          <strong class="p-name">{{ txn.patientName }}</strong>
                          <span class="p-phone">📱 {{ txn.patientMobile }}</span>
                        </div>
                      </div>
                    </td>

                    <!-- Description -->
                    <td class="col-desc">
                      <div class="desc-cell">
                        <strong class="desc-title">{{ txn.description }}</strong>
                        @if (txn.planName) {
                          <span class="plan-tag">💎 {{ txn.planName }}</span>
                        }
                      </div>
                    </td>

                    <!-- Amount -->
                    <td class="col-amount">
                      <strong class="amount-val">₹{{ txn.amount.toLocaleString('en-IN') }}</strong>
                    </td>

                    <!-- Payment Method -->
                    <td class="col-method">
                      @if (txn.paymentMethod === 'UPI') {
                        <span class="method-pill method-upi">📱 UPI</span>
                      } @else if (txn.paymentMethod === 'Card') {
                        <span class="method-pill method-card">💳 Card</span>
                      } @else if (txn.paymentMethod === 'Cash') {
                        <span class="method-pill method-cash">💵 Cash</span>
                      } @else if (txn.paymentMethod === 'Subscription') {
                        <span class="method-pill method-sub">💎 Plan Covered</span>
                      } @else {
                        <span class="method-pill method-other">{{ txn.paymentMethod }}</span>
                      }
                    </td>

                    <!-- Worker -->
                    <td class="col-worker">
                      @if (txn.workerName && txn.workerName !== 'Clinic') {
                        <span class="worker-pill">👨‍⚕️ {{ txn.workerName }}</span>
                      } @else {
                        <span class="clinic-pill">🏥 Clinic Direct</span>
                      }
                    </td>

                    <!-- Status -->
                    <td class="col-status">
                      <span class="status-badge status-paid">
                        <span class="dot"></span> Paid
                      </span>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="empty-table-cell">
                      <div class="empty-box">
                        <div class="empty-icon">💳</div>
                        <h3>No Transactions Found</h3>
                        <p>No financial entries match your selected criteria.</p>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .transactions-admin-page { padding: 4px; }
    .page-top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .page-title { font-size: 24px; font-weight: 800; color: #0F172A; margin: 0 0 4px; letter-spacing: -0.02em; }
    .page-sub { font-size: 13.5px; color: #64748B; margin: 0; }
    .top-status-badge { display: flex; align-items: center; gap: 8px; background: #DCFCE7; color: #166534; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; border: 1px solid #BBF7D0; }
    .live-dot { width: 7px; height: 7px; border-radius: 50%; background: #16A34A; animation: pulse 1.5s infinite; }

    // KPI Cards
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-card { background: #FFFFFF; border-radius: 18px; padding: 18px 20px; display: flex; align-items: center; gap: 16px; box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03); border: 1px solid rgba(226, 232, 240, 0.8); }
    .kpi-card.highlight-card { background: linear-gradient(135deg, #0B2545 0%, #134074 100%); border: none; }
    .kpi-icon-wrap { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
    .kpi-content { display: flex; flex-direction: column; }
    .kpi-label { font-size: 11.5px; font-weight: 700; color: #64748B; text-transform: uppercase; margin-bottom: 3px; }
    .kpi-value { font-size: 22px; font-weight: 800; color: #0F172A; }
    .kpi-sub-text { font-size: 11.5px; color: #94A3B8; margin-top: 2px; }

    // Controls Panel
    .controls-panel { background: #FFFFFF; border-radius: 16px; padding: 14px 18px; display: flex; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; border: 1px solid rgba(226, 232, 240, 0.8); }
    .search-wrap { flex: 1; min-width: 240px; position: relative; display: flex; align-items: center; }
    .search-wrap svg { position: absolute; left: 14px; pointer-events: none; }
    .search-input { width: 100%; height: 40px; padding: 0 14px 0 40px; border: 1.5px solid #E2E8F0; border-radius: 10px; background: #F8FAFC; font-size: 13.5px; color: #0F172A; outline: none; }
    .search-input:focus { background: #FFFFFF; border-color: #0284C7; }

    .filter-group { display: flex; align-items: center; gap: 6px; }
    .filter-lbl { font-size: 12px; font-weight: 700; color: #64748B; margin-right: 2px; }
    .filter-pill { background: #F1F5F9; border: 1px solid #E2E8F0; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer; transition: all 0.15s; }
    .filter-pill.active { background: #0B2545; color: white; border-color: #0B2545; font-weight: 700; }

    // Table
    .table-container-card { background: #FFFFFF; border-radius: 20px; box-shadow: 0 3px 16px rgba(15, 23, 42, 0.04); border: 1px solid rgba(226, 232, 240, 0.8); overflow: hidden; }
    .table-responsive { overflow-x: auto; }
    .txns-table { width: 100%; border-collapse: collapse; text-align: left; }
    .txns-table thead tr { background: #F8FAFC; border-bottom: 1.5px solid #E2E8F0; }
    .txns-table th { padding: 14px 18px; font-size: 11.5px; font-weight: 700; text-transform: uppercase; color: #64748B; letter-spacing: 0.05em; white-space: nowrap; }
    .txns-table tbody tr { border-bottom: 1px solid #F1F5F9; transition: background 0.1s ease; }
    .txns-table tbody tr:hover { background: #F8FAFC; }
    .txns-table td { padding: 16px 18px; font-size: 13.5px; color: #1E293B; vertical-align: middle; }

    .id-cell { display: flex; flex-direction: column; }
    .txn-id { font-family: monospace; font-size: 13px; color: #0B2545; font-weight: 800; }
    .txn-date { font-size: 11.5px; color: #64748B; margin-top: 2px; }

    .patient-cell { display: flex; align-items: center; gap: 10px; }
    .patient-avatar { width: 36px; height: 36px; border-radius: 10px; background: #0B2545; color: white; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; flex-shrink: 0; }
    .patient-info { display: flex; flex-direction: column; }
    .p-name { font-size: 13.5px; font-weight: 700; color: #0F172A; }
    .p-phone { font-size: 11.5px; color: #64748B; }

    .desc-cell { display: flex; flex-direction: column; gap: 3px; }
    .desc-title { font-size: 13.5px; color: #0F172A; }
    .plan-tag { display: inline-block; font-size: 11px; font-weight: 700; color: #7E22CE; background: #F3E8FF; padding: 2px 6px; border-radius: 4px; width: fit-content; }

    .amount-val { font-size: 15px; font-weight: 800; color: #10B981; }

    .method-pill { display: inline-block; padding: 4px 10px; border-radius: 8px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
    .method-upi { background: #EDE9FE; color: #6D28D9; border: 1px solid #DDD6FE; }
    .method-card { background: #E0F2FE; color: #0369A1; border: 1px solid #BAE6FD; }
    .method-cash { background: #DCFCE7; color: #15803D; border: 1px solid #BBF7D0; }
    .method-sub { background: #FEF3C7; color: #B45309; border: 1px solid #FDE68A; }
    .method-other { background: #F1F5F9; color: #475569; }

    .worker-pill { font-size: 12px; font-weight: 600; color: #334155; }
    .clinic-pill { font-size: 11.5px; font-weight: 600; color: #64748B; font-style: italic; }

    .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
    .status-badge .dot { width: 6px; height: 6px; border-radius: 50%; }
    .status-paid { background: #DCFCE7; color: #166534; border: 1px solid #BBF7D0; }
    .status-paid .dot { background: #16A34A; }

    .empty-table-cell { padding: 48px 24px !important; text-align: center; }
    .empty-box { display: flex; flex-direction: column; align-items: center; }
    .empty-icon { font-size: 40px; margin-bottom: 10px; }
    .empty-box h3 { font-size: 16px; font-weight: 700; color: #0F172A; margin: 0 0 4px; }
    .empty-box p { font-size: 13px; color: #64748B; margin: 0; }

    .loading-state { display: flex; flex-direction: column; align-items: center; padding: 60px 24px; gap: 12px; color: #64748B; }
    .spinner-ring { width: 32px; height: 32px; border: 3px solid #E2E8F0; border-top-color: #0284C7; border-radius: 50%; animation: spin 0.8s linear infinite; }

    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0% { transform: scale(0.95); opacity: 0.8; } 50% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(0.95); opacity: 0.8; } }
  `]
})
export class AdminTransactionsComponent implements OnInit, OnDestroy {
  private firestore = inject(Firestore);
  private txnsUnsub: Unsubscribe | null = null;

  transactions = signal<FormattedTransaction[]>([]);
  isLoading = signal<boolean>(true);

  searchQuery = signal<string>('');
  selectedMethod = signal<string>('All');

  ngOnInit() {
    this.listenToTransactions();
  }

  ngOnDestroy() {
    if (this.txnsUnsub) {
      this.txnsUnsub();
    }
  }

  private listenToTransactions() {
    this.isLoading.set(true);
    const txnsCol = collection(this.firestore, 'transactions');

    this.txnsUnsub = onSnapshot(txnsCol, (snap) => {
      const items: FormattedTransaction[] = [];
      snap.forEach(d => {
        const t = d.data() as Transaction;
        const id = d.id;

        let rawTimestamp = 0;
        let dateStr = 'Today';
        let timeStr = 'Recently';

        const ts = t.timestamp;
        if (ts) {
          if (typeof ts.toMillis === 'function') {
            rawTimestamp = ts.toMillis();
          } else if (ts.seconds) {
            rawTimestamp = ts.seconds * 1000;
          } else if (typeof ts === 'number') {
            rawTimestamp = ts;
          } else {
            const parsed = new Date(ts).getTime();
            if (!isNaN(parsed)) rawTimestamp = parsed;
          }

          if (rawTimestamp > 0) {
            const dt = new Date(rawTimestamp);
            dateStr = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
          }
        }

        const isSub = t.type === 'subscription' || !!t.planName;
        const desc = t.description || (isSub ? `Subscription: ${t.planName || 'Plan'}` : 'Physiotherapy Clinical Session');

        items.push({
          id,
          patientName: t.patientName || 'Patient',
          patientMobile: t.patientMobile || 'N/A',
          workerName: t.workerName || 'Clinic',
          amount: Number(t.amount) || 0,
          paymentMethod: t.paymentMethod || 'UPI',
          status: t.status || 'Paid',
          type: t.type || (isSub ? 'subscription' : 'session'),
          description: desc,
          planName: t.planName,
          dateStr,
          timeStr,
          rawTimestamp
        });
      });

      // Sort newest first
      items.sort((a, b) => b.rawTimestamp - a.rawTimestamp);
      this.transactions.set(items);
      this.isLoading.set(false);
    }, (err) => {
      console.error('Error fetching admin transactions:', err);
      this.isLoading.set(false);
    });
  }

  // Double-counting prevention:
  // When a subscription plan is bought, ₹10,000 is logged with paymentMethod 'UPI'/'Card'.
  // When a session is rendered under the plan, it is logged with paymentMethod 'Subscription'.
  // Total Net Revenue sums real incoming cash (UPI, Card, Cash, etc.) excluding 'Subscription' internal logs.
  totalNetRevenue = computed(() =>
    this.transactions()
      .filter(t => t.paymentMethod !== 'Subscription')
      .reduce((sum, t) => sum + t.amount, 0)
  );

  subscriptionRevenue = computed(() =>
    this.transactions()
      .filter(t => (t.type === 'subscription' || t.planName) && t.paymentMethod !== 'Subscription')
      .reduce((sum, t) => sum + t.amount, 0)
  );

  subscriptionTxnCount = computed(() =>
    this.transactions().filter(t => (t.type === 'subscription' || t.planName) && t.paymentMethod !== 'Subscription').length
  );

  walkInRevenue = computed(() =>
    this.transactions()
      .filter(t => t.type !== 'subscription' && !t.planName && t.paymentMethod !== 'Subscription')
      .reduce((sum, t) => sum + t.amount, 0)
  );

  walkInTxnCount = computed(() =>
    this.transactions().filter(t => t.type !== 'subscription' && !t.planName && t.paymentMethod !== 'Subscription').length
  );

  averageTxnValue = computed(() => {
    const cashTxns = this.transactions().filter(t => t.paymentMethod !== 'Subscription');
    if (!cashTxns.length) return 0;
    return Math.round(this.totalNetRevenue() / cashTxns.length);
  });

  filteredTransactions = computed(() => {
    let list = this.transactions();
    const query = this.searchQuery().toLowerCase().trim();
    const method = this.selectedMethod();

    if (query) {
      list = list.filter(t =>
        t.id.toLowerCase().includes(query) ||
        t.patientName.toLowerCase().includes(query) ||
        t.patientMobile.toLowerCase().includes(query) ||
        t.workerName.toLowerCase().includes(query) ||
        (t.planName && t.planName.toLowerCase().includes(query)) ||
        t.description.toLowerCase().includes(query)
      );
    }

    if (method !== 'All') {
      list = list.filter(t => t.paymentMethod === method);
    }

    return list;
  });
}
