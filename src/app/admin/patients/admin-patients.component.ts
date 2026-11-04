import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, query, where, onSnapshot, Unsubscribe } from '@angular/fire/firestore';
import { User } from '../../core/models/user.model';
import { Session } from '../../core/models/session.model';
import { UserSubscription } from '../../core/models/subscription.model';

interface PatientRow {
  uid: string;
  name: string;
  mobileNumber: string;
  hasActiveSubscription: boolean;
  planName: string;
  totalSessions: number;
  remainingSessions: number;
  completedSessions: number;
  createdAt: string;
}

@Component({
  selector: 'app-admin-patients',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="patients-admin-page animate-fade-in">
      <!-- Top Bar -->
      <header class="page-top-bar">
        <div>
          <h1 class="page-title">Patients Directory</h1>
          <p class="page-sub">Manage registered patients, monitor treatment progress, and verify subscription status</p>
        </div>
        <div class="top-status-badge">
          <span class="live-dot"></span>
          <span>Live Patient Sync</span>
        </div>
      </header>

      <!-- KPI Summary Cards -->
      <section class="kpi-grid">
        <div class="kpi-card highlight-card">
          <div class="kpi-icon-wrap icon-primary">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-label label-light">Total Patients</span>
            <span class="kpi-value val-light">{{ patients().length }}</span>
            <span class="kpi-sub-text sub-light">Clinical registrations</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-wrap icon-plan">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 3h12l4 6-10 12L2 9z"></path>
            </svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Active Plan Subscribers</span>
            <span class="kpi-value">{{ activeSubscriberCount() }}</span>
            <span class="kpi-sub-text">Under treatment package</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-wrap icon-treatments">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Treatments Completed</span>
            <span class="kpi-value">{{ totalCompletedTreatments() }}</span>
            <span class="kpi-sub-text">Delivered clinical sessions</span>
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
            placeholder="Search patient name, mobile number..."
            [value]="searchQuery()"
            (input)="searchQuery.set($any($event.target).value)"
            class="search-input"
            id="patient-search-input"
          />
        </div>

        <div class="filter-group">
          <span class="filter-lbl">Status:</span>
          @for (filter of ['All', 'Subscribed', 'Walk-In']; track filter) {
            <button
              type="button"
              class="filter-pill"
              [class.active]="selectedFilter() === filter"
              (click)="selectedFilter.set(filter)"
            >
              {{ filter }}
            </button>
          }
        </div>
      </div>

      <!-- Patients Table -->
      <div class="table-container-card">
        @if (isLoading()) {
          <div class="loading-state">
            <div class="spinner-ring"></div>
            <p>Loading clinic patients...</p>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="patients-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Contact</th>
                  <th>Subscription Plan</th>
                  <th>Plan Balance</th>
                  <th>Treatments Done</th>
                  <th>Registered</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (patient of filteredPatients(); track patient.uid) {
                  <tr class="table-row">
                    <!-- Patient -->
                    <td class="col-patient">
                      <div class="patient-cell">
                        <div class="avatar-bubble">
                          {{ (patient.name || 'P').charAt(0).toUpperCase() }}
                        </div>
                        <div class="patient-text">
                          <strong class="name">{{ patient.name }}</strong>
                          <span class="pid">UID: {{ patient.uid.slice(0, 8) }}</span>
                        </div>
                      </div>
                    </td>

                    <!-- Contact -->
                    <td class="col-contact">
                      <span class="contact-pill">+91 {{ patient.mobileNumber }}</span>
                    </td>

                    <!-- Subscription Plan -->
                    <td class="col-plan">
                      @if (patient.hasActiveSubscription) {
                        <span class="sub-plan-badge" [class.badge-gold]="patient.planName.toLowerCase().includes('month')">
                          {{ patient.planName }}
                        </span>
                      } @else {
                        <span class="no-sub-badge">Direct Walk-In</span>
                      }
                    </td>

                    <!-- Plan Balance with Progress -->
                    <td class="col-balance">
                      @if (patient.hasActiveSubscription && patient.totalSessions > 0) {
                        <div class="progress-block">
                          <div class="prog-labels">
                            <span class="remain-text">{{ patient.remainingSessions }} left</span>
                            <span class="sub-ratio">{{ patient.totalSessions - patient.remainingSessions }}/{{ patient.totalSessions }}</span>
                          </div>
                          <div class="prog-track">
                            <div class="prog-fill" [style.width.%]="getPercent(patient.totalSessions - patient.remainingSessions, patient.totalSessions)"></div>
                          </div>
                        </div>
                      } @else {
                        <span class="text-muted">—</span>
                      }
                    </td>

                    <!-- Treatments Completed -->
                    <td class="col-completed">
                      <span class="completed-badge">{{ patient.completedSessions }} Sessions</span>
                    </td>

                    <!-- Registered Date -->
                    <td class="col-date">
                      <span class="reg-date">{{ patient.createdAt | date:'d MMM, y' }}</span>
                    </td>

                    <!-- Status -->
                    <td class="col-status">
                      @if (patient.hasActiveSubscription) {
                        <span class="status-pill status-active">
                          <span class="pulse-dot"></span>
                          Subscribed
                        </span>
                      } @else {
                        <span class="status-pill status-walkin">
                          Walk-In
                        </span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="empty-table-cell">
                      <div class="empty-box">
                        <div class="empty-icon-wrap">
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                          </svg>
                        </div>
                        <h3>No Patients Found</h3>
                        <p>No registered patients match your current search criteria.</p>
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
    .patients-admin-page { padding: 0; }
    .page-top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
    .page-title { font-size: 20px; font-weight: 700; color: #0F172A; margin: 0 0 2px; letter-spacing: -0.01em; }
    .page-sub { font-size: 12.5px; color: #64748B; margin: 0; }
    .top-status-badge { display: inline-flex; align-items: center; gap: 6px; background: #DCFCE7; color: #166534; border: 1px solid #BBF7D0; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .live-dot { width: 6px; height: 6px; border-radius: 50%; background: #16A34A; animation: pulse 1.5s infinite; }

    // KPI Cards
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-bottom: 16px; }
    .kpi-card { background: #FFFFFF; border-radius: 12px; padding: 16px 18px; display: flex; align-items: flex-start; gap: 14px; box-shadow: 0 1px 4px rgba(15, 23, 42, 0.03); border: 1px solid rgba(226, 232, 240, 0.85); transition: transform 0.15s ease, box-shadow 0.15s ease; min-height: 82px; box-sizing: border-box; }
    .kpi-card:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05); }
    .kpi-card.highlight-card { background: linear-gradient(135deg, #0B2545 0%, #134074 100%); border: none; box-shadow: 0 4px 14px rgba(11, 37, 69, 0.2); }
    .kpi-icon-wrap { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .kpi-icon-wrap svg { width: 20px; height: 20px; }
    .kpi-icon-wrap.icon-primary { background: rgba(255, 255, 255, 0.18); color: #FFFFFF; }
    .kpi-icon-wrap.icon-plan { background: #FEF3C7; color: #D97706; border: 1px solid #FDE68A; }
    .kpi-icon-wrap.icon-treatments { background: #DCFCE7; color: #16A34A; border: 1px solid #BBF7D0; }
    .kpi-content { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .kpi-label { font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.03em; line-height: 1.25; }
    .kpi-label.label-light { color: rgba(255, 255, 255, 0.85); }
    .kpi-value { font-size: 22px; font-weight: 750; color: #0F172A; line-height: 1.15; }
    .kpi-value.val-light { color: #FFFFFF; }
    .kpi-sub-text { font-size: 11px; color: #94A3B8; font-weight: 500; margin-top: 1px; }
    .kpi-sub-text.sub-light { color: rgba(255, 255, 255, 0.7); }

    // Controls
    .controls-panel { background: #FFFFFF; border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; flex-wrap: wrap; gap: 14px; margin-bottom: 16px; border: 1px solid rgba(226, 232, 240, 0.85); box-shadow: 0 1px 4px rgba(15, 23, 42, 0.02); }
    .search-wrap { flex: 1; min-width: 240px; position: relative; display: flex; align-items: center; }
    .search-wrap svg { position: absolute; left: 12px; width: 16px; height: 16px; pointer-events: none; }
    .search-input { width: 100%; height: 38px; padding: 0 12px 0 36px; border: 1.5px solid #E2E8F0; border-radius: 8px; background: #F8FAFC; font-size: 13px; color: #0F172A; outline: none; }
    .search-input:focus { background: #FFFFFF; border-color: #0284C7; }
    .filter-group { display: flex; align-items: center; gap: 6px; }
    .filter-lbl { font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.03em; }
    .filter-pill { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 6px 13px; border-radius: 7px; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer; transition: all 0.15s; }
    .filter-pill:hover { background: #F1F5F9; color: #0F172A; }
    .filter-pill.active { background: #0B2545; color: white; border-color: #0B2545; font-weight: 700; box-shadow: 0 1px 4px rgba(11, 37, 69, 0.2); }

    // Table
    .table-container-card { background: #FFFFFF; border-radius: 12px; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03); border: 1px solid rgba(226, 232, 240, 0.85); overflow: hidden; }
    .table-responsive { overflow-x: auto; }
    .patients-table { width: 100%; border-collapse: collapse; text-align: left; }
    .patients-table thead tr { background: #F8FAFC; border-bottom: 1.5px solid #E2E8F0; }
    .patients-table th { padding: 11px 14px; font-size: 11.5px; font-weight: 600; text-transform: uppercase; color: #64748B; letter-spacing: 0.03em; white-space: nowrap; }
    .patients-table tbody tr { border-bottom: 1px solid #F1F5F9; transition: background 0.1s ease; }
    .patients-table tbody tr:hover { background: #F8FAFC; }
    .empty-icon-wrap { width: 44px; height: 44px; border-radius: 12px; background: #F1F5F9; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
    .empty-icon-wrap svg { width: 24px; height: 24px; }
    .patients-table td { padding: 11px 14px; font-size: 12.5px; color: #1E293B; vertical-align: middle; }

    .col-patient .patient-cell { display: flex; align-items: center; gap: 10px; }
    .avatar-bubble { width: 32px; height: 32px; border-radius: 8px; background: #EFF6FF; color: #2563EB; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .patient-text { display: flex; flex-direction: column; gap: 1px; }
    .name { font-size: 13px; font-weight: 600; color: #0F172A; }
    .pid { font-size: 11px; color: #94A3B8; font-family: monospace; }

    .contact-pill { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 3px 8px; border-radius: 6px; font-size: 11.5px; font-weight: 600; color: #334155; }
    .sub-plan-badge { background: #E0F2FE; color: #0284C7; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; border: 1px solid #BAE6FD; white-space: nowrap; }
    .sub-plan-badge.badge-gold { background: #FEF3C7; color: #92400E; border-color: #FDE68A; }
    .no-sub-badge { color: #94A3B8; font-size: 11.5px; font-weight: 500; }

    .progress-block { display: flex; flex-direction: column; gap: 4px; min-width: 140px; }
    .prog-labels { display: flex; justify-content: space-between; font-size: 11px; }
    .remain-text { font-weight: 700; color: #0284C7; }
    .sub-ratio { color: #64748B; }
    .prog-track { width: 100%; height: 5px; background: #F1F5F9; border-radius: 999px; overflow: hidden; }
    .prog-fill { height: 100%; background: #0284C7; border-radius: 999px; }

    .completed-badge { background: #F1F5F9; color: #1E293B; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
    .reg-date { font-size: 12px; color: #64748B; font-weight: 500; }
    .text-muted { color: #CBD5E1; }

    .status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    .status-active { background: #DCFCE7; color: #15803D; border: 1px solid rgba(22, 163, 74, 0.2); }
    .status-walkin { background: #F1F5F9; color: #64748B; border: 1px solid #E2E8F0; }
    .pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: #16A34A; animation: pulse 1.5s infinite; }

    .empty-table-cell { padding: 32px 16px !important; text-align: center; }
    .empty-box { display: flex; flex-direction: column; align-items: center; }
    .empty-icon { font-size: 32px; margin-bottom: 8px; }
    .empty-box h3 { font-size: 14px; font-weight: 700; color: #0F172A; margin: 0 0 4px; }
    .empty-box p { font-size: 12px; color: #64748B; margin: 0; }

    .loading-state { display: flex; flex-direction: column; align-items: center; padding: 40px 16px; gap: 10px; color: #64748B; }
    .spinner-ring { width: 26px; height: 26px; border: 2.5px solid #E2E8F0; border-top-color: #0284C7; border-radius: 50%; animation: spin 0.8s linear infinite; }

    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0% { transform: scale(0.95); opacity: 0.8; } 50% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(0.95); opacity: 0.8; } }
  `]
})
export class AdminPatientsComponent implements OnInit, OnDestroy {
  private firestore = inject(Firestore);

  private usersUnsub: Unsubscribe | null = null;
  private subsUnsub: Unsubscribe | null = null;
  private sessionsUnsub: Unsubscribe | null = null;

  patients = signal<User[]>([]);
  activeSubsMap = signal<Record<string, UserSubscription>>({});
  completedSessionsMap = signal<Record<string, number>>({});
  isLoading = signal<boolean>(true);

  searchQuery = signal<string>('');
  selectedFilter = signal<string>('All');

  patientRows = computed<PatientRow[]>(() => {
    const subs = this.activeSubsMap();
    const sessions = this.completedSessionsMap();

    return this.patients().map(p => {
      const sub = subs[p.uid] || (p.mobileNumber ? subs[p.mobileNumber] : null);
      const sessDone = sessions[p.uid] || (p.mobileNumber ? sessions[p.mobileNumber] : 0);

      const hasActiveSub = !!(sub && (sub.remainingSessions ?? 0) > 0 && sub.status === 'active');
      return {
        uid: p.uid,
        name: p.name || 'Patient',
        mobileNumber: p.mobileNumber || '',
        hasActiveSubscription: hasActiveSub,
        planName: hasActiveSub ? (sub.planName || 'Active Plan') : '',
        totalSessions: hasActiveSub ? (sub.totalSessions || 0) : 0,
        remainingSessions: hasActiveSub ? (sub.remainingSessions ?? 0) : 0,
        completedSessions: Math.max(p.completedSessions || 0, sessDone),
        createdAt: p.createdAt || new Date().toISOString()
      };
    });
  });

  activeSubscriberCount = computed(() =>
    this.patientRows().filter(p => p.hasActiveSubscription).length
  );

  totalCompletedTreatments = computed(() =>
    this.patientRows().reduce((sum, p) => sum + p.completedSessions, 0)
  );

  filteredPatients = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const filter = this.selectedFilter();

    return this.patientRows().filter(p => {
      const nameMatch = (p.name || '').toLowerCase().includes(q);
      const phoneMatch = (p.mobileNumber || '').includes(q);
      const matchesSearch = !q || nameMatch || phoneMatch;

      let matchesFilter = true;
      if (filter === 'Subscribed') {
        matchesFilter = p.hasActiveSubscription;
      } else if (filter === 'Walk-In') {
        matchesFilter = !p.hasActiveSubscription;
      }

      return matchesSearch && matchesFilter;
    });
  });

  ngOnInit() {
    this.listenToData();
  }

  ngOnDestroy() {
    this.usersUnsub?.();
    this.subsUnsub?.();
    this.sessionsUnsub?.();
  }

  private listenToData() {
    // 1. Listen to patients in users collection
    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where('role', '==', 'patient'));
    this.usersUnsub = onSnapshot(q, snap => {
      const list: User[] = [];
      snap.forEach(d => {
        list.push({ ...(d.data() as User), uid: d.id });
      });
      this.patients.set(list);
      this.isLoading.set(false);
    }, () => this.isLoading.set(false));

    // 2. Listen to active subscriptions
    const subRef = collection(this.firestore, 'subscriptions');
    const subQ = query(subRef, where('status', '==', 'active'));
    this.subsUnsub = onSnapshot(subQ, snap => {
      const map: Record<string, UserSubscription> = {};
      snap.forEach(d => {
        const s = d.data() as UserSubscription;
        if (s.patientId) {
          map[s.patientId] = s;
        }
      });
      this.activeSubsMap.set(map);
    });

    // 3. Listen to completed sessions
    const sessRef = collection(this.firestore, 'sessions');
    this.sessionsUnsub = onSnapshot(sessRef, snap => {
      const countMap: Record<string, number> = {};
      snap.forEach(d => {
        const s = d.data() as Session;
        if (s.status === 'completed' && s.patientId) {
          countMap[s.patientId] = (countMap[s.patientId] || 0) + 1;
        }
      });
      this.completedSessionsMap.set(countMap);
    });
  }

  getPercent(done: number, total: number): number {
    if (!total) return 0;
    return Math.min(100, Math.round((done / total) * 100));
  }
}
