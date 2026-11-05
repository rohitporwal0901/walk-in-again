import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, onSnapshot, Unsubscribe } from '@angular/fire/firestore';
import { Session, calculateSessionEarning } from '../../core/models/session.model';

interface FormattedSession {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  workerId: string;
  workerName: string;
  status: 'pending_otp' | 'active' | 'completed' | 'cancelled' | 'pending';
  paymentStatus: 'paid' | 'pending' | 'failed';
  isCoveredBySubscription: boolean;
  planName?: string;
  fee: number;
  sessionValue: number;
  therapies: string[];
  durationMinutes: number;
  dateStr: string;
  timeStr: string;
  rawTimestamp: number;
}

@Component({
  selector: 'app-admin-sessions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sessions-admin-page animate-fade-in">
      <!-- Top Bar -->
      <header class="page-top-bar">
        <div>
          <h1 class="page-title">Clinical Sessions</h1>
          <p class="page-sub">Monitor live physiotherapy treatments, clinical logs, and session payment statuses</p>
        </div>
        <div class="top-status-badge">
          <span class="live-dot"></span>
          <span>Live Session Sync</span>
        </div>
      </header>

      <!-- KPI Summary Cards -->
      <section class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-icon-wrap icon-primary">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Total Sessions</span>
            <span class="kpi-value">{{ sessions().length }}</span>
            <span class="kpi-sub-text">All-time clinic sessions</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-wrap icon-active">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Active In Clinic</span>
            <span class="kpi-value">{{ activeSessionsCount() }}</span>
            <span class="kpi-sub-text">Currently ongoing</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-wrap icon-completed">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Completed Sessions</span>
            <span class="kpi-value">{{ completedSessionsCount() }}</span>
            <span class="kpi-sub-text">Successfully finished</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-wrap icon-value">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Total Session Value</span>
            <span class="kpi-value">₹{{ totalSessionValue().toLocaleString('en-IN') }}</span>
            <span class="kpi-sub-text">Calculated staff value</span>
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
            placeholder="Search patient, physiotherapist, session ID..."
            [value]="searchQuery()"
            (input)="searchQuery.set($any($event.target).value)"
            class="search-input"
            id="session-search-input"
          />
        </div>

        <div class="filter-group">
          <span class="filter-lbl">Status:</span>
          @for (f of ['All', 'active', 'completed', 'pending_otp']; track f) {
            <button
              type="button"
              class="filter-pill"
              [class.active]="selectedStatus() === f"
              (click)="selectedStatus.set(f)"
            >
              {{ getStatusLabel(f) }}
            </button>
          }
        </div>

        <div class="filter-group">
          <span class="filter-lbl">Type:</span>
          @for (t of ['All', 'Plan Covered', 'Walk-In']; track t) {
            <button
              type="button"
              class="filter-pill"
              [class.active]="selectedType() === t"
              (click)="selectedType.set(t)"
            >
              {{ t }}
            </button>
          }
        </div>
      </div>

      <!-- Sessions Table -->
      <div class="table-container-card">
        @if (isLoading()) {
          <div class="loading-state">
            <div class="spinner-ring"></div>
            <p>Fetching clinical sessions from database...</p>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="sessions-table">
              <thead>
                <tr>
                  <th>Session ID & Time</th>
                  <th>Patient</th>
                  <th>Physiotherapist</th>
                  <th>Type & Plan</th>
                  <th>Therapies</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                @for (sess of filteredSessions(); track sess.id || $index) {
                  <tr class="table-row" [id]="'session-row-' + sess.id">
                    <!-- Session ID & Time -->
                    <td class="col-id">
                      <div class="id-cell">
                        <strong class="session-id">#{{ sess.id.length > 8 ? sess.id.slice(0, 8) : sess.id }}</strong>
                        <span class="session-date">{{ sess.dateStr }} • {{ sess.timeStr }}</span>
                      </div>
                    </td>

                    <!-- Patient -->
                    <td class="col-patient">
                      <div class="patient-cell">
                        <div class="patient-avatar">
                          {{ (sess.patientName || 'P').charAt(0).toUpperCase() }}
                        </div>
                        <div class="patient-info">
                          <strong class="p-name">{{ sess.patientName }}</strong>
                          <span class="p-phone">{{ sess.patientPhone }}</span>
                        </div>
                      </div>
                    </td>

                    <!-- Worker -->
                    <td class="col-worker">
                      <div class="worker-pill">
                        <span class="worker-dot"></span>
                        <span>{{ sess.workerName }}</span>
                      </div>
                    </td>

                    <!-- Type & Plan -->
                    <td class="col-type">
                      @if (sess.isCoveredBySubscription) {
                        <span class="plan-badge">
                          {{ sess.planName || 'Active Plan' }}
                        </span>
                      } @else {
                        <span class="walkin-badge">
                          Walk-In Session
                        </span>
                      }
                    </td>

                    <!-- Therapies -->
                    <td class="col-therapies">
                      <div class="therapies-chips">
                        @for (t of sess.therapies.slice(0, 2); track $index) {
                          <span class="therapy-tag">{{ t }}</span>
                        }
                        @if (sess.therapies.length > 2) {
                          <span class="therapy-more">+{{ sess.therapies.length - 2 }}</span>
                        }
                        @if (!sess.therapies.length) {
                          <span class="therapy-empty">General Assessment</span>
                        }
                      </div>
                    </td>

                    <!-- Value -->
                    <td class="col-value">
                      <strong class="fee-text">₹{{ sess.sessionValue }}</strong>
                    </td>

                    <!-- Status -->
                    <td class="col-status">
                      @if (sess.status === 'completed') {
                        <span class="status-badge status-completed">
                          <span class="dot"></span> Completed
                        </span>
                      } @else if (sess.status === 'active') {
                        <span class="status-badge status-active">
                          <span class="dot pulse"></span> In Progress
                        </span>
                      } @else if (sess.status === 'pending_otp' || sess.status === 'pending') {
                        <span class="status-badge status-pending">
                          <span class="dot"></span> Pending OTP
                        </span>
                      } @else {
                        <span class="status-badge status-cancelled">
                          {{ sess.status }}
                        </span>
                      }
                    </td>

                    <!-- Payment -->
                    <td class="col-payment">
                      @if (sess.isCoveredBySubscription) {
                        <span class="pay-badge pay-plan">Covered</span>
                      } @else if (sess.paymentStatus === 'paid') {
                        <span class="pay-badge pay-paid">Paid</span>
                      } @else {
                        <span class="pay-badge pay-unpaid">Pending</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="8" class="empty-table-cell">
                      <div class="empty-box">
                        <div class="empty-icon-wrap">
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                          </svg>
                        </div>
                        <h3>No Sessions Found</h3>
                        <p>No clinical sessions match your selected filters.</p>
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
    .sessions-admin-page {
      padding: 0;
    }

    .page-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 14px;
    }

    .page-title {
      font-size: 22px;
      font-weight: 800;
      color: #0F172A;
      margin: 0 0 3px;
      letter-spacing: -0.02em;
    }

    .page-sub {
      font-size: 13px;
      color: #64748B;
      font-weight: 500;
      margin: 0;
    }

    .top-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #DCFCE7;
      color: #166534;
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 700;
      border: 1px solid #BBF7D0;
    }

    .live-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #16A34A;
      animation: pulse 1.5s infinite;
    }

    // KPI Cards Grid
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }

    .kpi-card {
      background: #FFFFFF;
      border-radius: 18px;
      padding: 18px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
      border: 1px solid rgba(226, 232, 240, 0.85);
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      box-sizing: border-box;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.07);
        border-color: rgba(2, 132, 199, 0.3);
      }
    }

    .kpi-icon-wrap {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      svg {
        width: 24px;
        height: 24px;
      }

      &.icon-primary {
        background: #E0F2FE;
        color: #0284C7;
      }

      &.icon-active {
        background: #DCFCE7;
        color: #16A34A;
      }

      &.icon-completed {
        background: #EDE9FE;
        color: #7C3AED;
      }

      &.icon-value {
        background: #FEF3C7;
        color: #D97706;
      }
    }

    .kpi-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .kpi-label {
      font-size: 12px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .kpi-value {
      font-size: 24px;
      font-weight: 800;
      color: #0F172A;
      line-height: 1.15;
      letter-spacing: -0.02em;
    }

    .kpi-sub-text {
      font-size: 12px;
      color: #94A3B8;
      font-weight: 500;
    }

    // Controls Panel
    .controls-panel {
      background: #FFFFFF;
      border-radius: 18px;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 20px;
      border: 1px solid rgba(226, 232, 240, 0.85);
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
    }

    .search-wrap {
      flex: 1;
      min-width: 250px;
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-wrap svg {
      position: absolute;
      left: 14px;
      width: 17px;
      height: 17px;
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      height: 40px;
      padding: 0 14px 0 40px;
      border: 1.5px solid #E2E8F0;
      border-radius: 10px;
      background: #F8FAFC;
      font-size: 13px;
      color: #0F172A;
      outline: none;
      transition: all 0.2s ease;

      &:focus {
        background: #FFFFFF;
        border-color: #0284C7;
        box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.12);
      }
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .filter-lbl {
      font-size: 12px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .filter-pill {
      background: #F8FAFC;
      border: 1.5px solid #E2E8F0;
      padding: 7px 15px;
      border-radius: 10px;
      font-size: 12.5px;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        background: #F1F5F9;
        color: #0F172A;
        border-color: #CBD5E1;
      }

      &.active {
        background: linear-gradient(135deg, #0284C7 0%, #0D9488 100%);
        color: #FFFFFF;
        border-color: transparent;
        font-weight: 700;
        box-shadow: 0 4px 12px rgba(2, 132, 199, 0.28);
      }
    }

    // Table
    .table-container-card {
      background: #FFFFFF;
      border-radius: 18px;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
      border: 1px solid rgba(226, 232, 240, 0.85);
      overflow: hidden;
    }

    .table-responsive {
      overflow-x: auto;
    }

    .sessions-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .sessions-table thead tr {
      background: #F8FAFC;
      border-bottom: 1.5px solid #E2E8F0;
    }

    .sessions-table th {
      padding: 14px 16px;
      font-size: 11.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748B;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }

    .sessions-table tbody tr {
      border-bottom: 1px solid #F1F5F9;
      transition: background 0.15s ease;

      &:hover {
        background: #F8FAFC;
      }
    }

    .sessions-table td {
      padding: 14px 16px;
      font-size: 13px;
      color: #1E293B;
      vertical-align: middle;
    }

    .id-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .session-id {
      font-family: monospace;
      font-size: 12px;
      color: #0284C7;
      font-weight: 700;
    }

    .session-date {
      font-size: 11.5px;
      color: #64748B;
    }

    .patient-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .patient-avatar {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: #E0F2FE;
      color: #0284C7;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 800;
      flex-shrink: 0;
    }

    .patient-info {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .p-name {
      font-size: 13.5px;
      font-weight: 700;
      color: #0F172A;
    }

    .p-phone {
      font-size: 11.5px;
      color: #64748B;
    }

    .worker-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      color: #1E293B;
    }

    .worker-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #0284C7;
    }

    .plan-badge {
      background: #EDE9FE;
      color: #6D28D9;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 11.5px;
      font-weight: 700;
      border: 1px solid #DDD6FE;
      white-space: nowrap;
    }

    .walkin-badge {
      background: #F1F5F9;
      color: #475569;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 11.5px;
      font-weight: 600;
      border: 1px solid #E2E8F0;
      white-space: nowrap;
    }

    .therapies-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      max-width: 220px;
    }

    .therapy-tag {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      font-size: 11.5px;
      padding: 3px 8px;
      border-radius: 6px;
      color: #334155;
      font-weight: 500;
    }

    .therapy-more {
      background: #E2E8F0;
      font-size: 10.5px;
      padding: 3px 7px;
      border-radius: 6px;
      color: #475569;
      font-weight: 700;
    }

    .therapy-empty {
      font-size: 12px;
      color: #94A3B8;
      font-style: italic;
    }

    .fee-text {
      font-size: 14px;
      font-weight: 800;
      color: #0F172A;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 700;
      white-space: nowrap;
    }

    .status-badge .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .status-completed {
      background: #DCFCE7;
      color: #166534;
      border: 1px solid #BBF7D0;
    }

    .status-completed .dot {
      background: #16A34A;
    }

    .status-active {
      background: #E0F2FE;
      color: #0284C7;
      border: 1px solid #BAE6FD;
    }

    .status-active .dot {
      background: #0284C7;
      animation: pulse 1.5s infinite;
    }

    .status-pending {
      background: #FEF3C7;
      color: #92400E;
      border: 1px solid #FDE68A;
    }

    .status-pending .dot {
      background: #D97706;
    }

    .status-cancelled {
      background: #FEE2E2;
      color: #991B1B;
      border: 1px solid #FECACA;
    }

    .pay-badge {
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 11.5px;
      font-weight: 700;
      white-space: nowrap;
    }

    .pay-plan {
      background: #EDE9FE;
      color: #6D28D9;
      border: 1px solid #DDD6FE;
    }

    .pay-paid {
      background: #DCFCE7;
      color: #166534;
      border: 1px solid #BBF7D0;
    }

    .pay-unpaid {
      background: #FEF3C7;
      color: #92400E;
      border: 1px solid #FDE68A;
    }

    .empty-table-cell {
      padding: 40px 16px !important;
      text-align: center;
    }

    .empty-box {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .empty-icon-wrap {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: #F1F5F9;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;

      svg {
        width: 28px;
        height: 28px;
      }
    }

    .empty-box h3 {
      font-size: 15px;
      font-weight: 800;
      color: #0F172A;
      margin: 0 0 4px;
    }

    .empty-box p {
      font-size: 12.5px;
      color: #64748B;
      margin: 0;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px 16px;
      gap: 12px;
      color: #64748B;
    }

    .spinner-ring {
      width: 28px;
      height: 28px;
      border: 2.5px solid #E2E8F0;
      border-top-color: #0284C7;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @keyframes pulse {
      0% { transform: scale(0.95); opacity: 0.8; }
      50% { transform: scale(1.2); opacity: 1; }
      100% { transform: scale(0.95); opacity: 0.8; }
    }
  `]
})
export class AdminSessionsComponent implements OnInit, OnDestroy {
  private firestore = inject(Firestore);
  private sessionsUnsub: Unsubscribe | null = null;

  sessions = signal<FormattedSession[]>([]);
  isLoading = signal<boolean>(true);

  searchQuery = signal<string>('');
  selectedStatus = signal<string>('All');
  selectedType = signal<string>('All');

  getStatusLabel(status: string): string {
    if (status === 'All' || status === 'all') return 'All';
    if (status === 'pending_otp' || status === 'pending') return 'Pending OTP';
    if (status === 'active') return 'In Progress';
    if (status === 'completed') return 'Completed';
    if (status === 'cancelled') return 'Cancelled';
    return status;
  }

  ngOnInit() {
    this.listenToSessions();
  }

  ngOnDestroy() {
    if (this.sessionsUnsub) {
      this.sessionsUnsub();
    }
  }

  private listenToSessions() {
    this.isLoading.set(true);
    const sessionsCol = collection(this.firestore, 'sessions');

    this.sessionsUnsub = onSnapshot(sessionsCol, (snap) => {
      const items: FormattedSession[] = [];
      snap.forEach(d => {
        const s = d.data() as Session;
        const id = d.id;

        // Parse date and time safely from all possible fields
        let rawTimestamp = 0;
        let dateStr = 'Today';
        let timeStr = s.timeSlot || 'Recently';

        const ts = s.createdAt || s.startedAt || s.date || (s as any).startTime || (s as any).timestamp;
        if (ts) {
          if (typeof ts.toMillis === 'function') {
            rawTimestamp = ts.toMillis();
          } else if (ts.seconds) {
            rawTimestamp = ts.seconds * 1000;
          } else if (typeof ts === 'number') {
            rawTimestamp = ts;
          } else if (typeof ts === 'string') {
            const parsed = new Date(ts).getTime();
            if (!isNaN(parsed)) rawTimestamp = parsed;
          }

          if (rawTimestamp > 0) {
            const dt = new Date(rawTimestamp);
            dateStr = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
          }
        }

        // Safely extract therapies as string array
        let therapyList: string[] = [];
        if (Array.isArray(s.therapies)) {
          therapyList = s.therapies.map((t: any) => {
            if (typeof t === 'string') return t;
            if (t && typeof t === 'object' && t.label) return t.label;
            if (t && typeof t === 'object' && t.id) return t.id;
            return String(t);
          }).filter((t: string) => t && t.trim().length > 0);
        } else if (typeof s.therapies === 'string' && (s.therapies as string).trim()) {
          therapyList = [(s.therapies as string).trim()];
        }

        const value = s.sessionValue !== undefined && s.sessionValue !== null
          ? Number(s.sessionValue)
          : calculateSessionEarning(s);

        const patientMobile = (s as any).patientMobile || (s as any).patientPhone || 'N/A';
        const rawStatus = (s.status || 'pending_otp').toLowerCase();
        let normalizedStatus: 'pending_otp' | 'active' | 'completed' | 'cancelled' | 'pending' = 'pending_otp';
        if (rawStatus === 'completed') normalizedStatus = 'completed';
        else if (rawStatus === 'active') normalizedStatus = 'active';
        else if (rawStatus === 'cancelled') normalizedStatus = 'cancelled';
        else if (rawStatus === 'pending') normalizedStatus = 'pending';
        else normalizedStatus = 'pending_otp';

        items.push({
          id,
          patientId: s.patientId || '',
          patientName: s.patientName || 'Walk-In Patient',
          patientPhone: patientMobile,
          workerId: s.workerId || '',
          workerName: s.workerName || 'Physiotherapist',
          status: normalizedStatus,
          paymentStatus: s.paymentStatus || 'pending',
          isCoveredBySubscription: !!s.isCoveredBySubscription,
          planName: s.planName,
          fee: Number(s.fee) || 0,
          sessionValue: isNaN(value) ? 500 : value,
          therapies: therapyList,
          durationMinutes: Number(s.duration) || Number((s as any).durationMinutes) || 45,
          dateStr,
          timeStr,
          rawTimestamp
        });
      });

      // Sort newest first
      items.sort((a, b) => b.rawTimestamp - a.rawTimestamp);
      this.sessions.set(items);
      this.isLoading.set(false);
    }, (err) => {
      console.error('Error fetching admin sessions:', err);
      this.isLoading.set(false);
    });
  }

  // Computed KPIs
  activeSessionsCount = computed(() =>
    this.sessions().filter(s => s.status === 'active').length
  );

  completedSessionsCount = computed(() =>
    this.sessions().filter(s => s.status === 'completed').length
  );

  totalSessionValue = computed(() =>
    this.sessions().reduce((sum, s) => sum + (s.sessionValue || 0), 0)
  );

  filteredSessions = computed(() => {
    let list = this.sessions();
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.selectedStatus().toLowerCase();
    const type = this.selectedType();

    if (query) {
      list = list.filter(s =>
        s.id.toLowerCase().includes(query) ||
        s.patientName.toLowerCase().includes(query) ||
        s.patientPhone.toLowerCase().includes(query) ||
        s.workerName.toLowerCase().includes(query) ||
        (s.planName && s.planName.toLowerCase().includes(query))
      );
    }

    if (status !== 'all') {
      if (status === 'pending_otp' || status === 'pending') {
        list = list.filter(s => s.status === 'pending_otp' || s.status === 'pending');
      } else {
        list = list.filter(s => s.status.toLowerCase() === status);
      }
    }

    if (type === 'Plan Covered') {
      list = list.filter(s => s.isCoveredBySubscription);
    } else if (type === 'Walk-In') {
      list = list.filter(s => !s.isCoveredBySubscription);
    }

    return list;
  });
}
