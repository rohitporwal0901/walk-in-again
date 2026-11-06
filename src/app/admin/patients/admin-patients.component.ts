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

      <!-- KPI Summary Cards (HealthHub Gradient Style) -->
      <section class="kpi-grid">
        <div class="kpi-card kpi-card-teal">
          <div class="kpi-top-row">
            <span class="kpi-label">Total Patients</span>
          </div>
          <div class="kpi-bottom-row">
            <span class="kpi-value">{{ patients().length }}</span>
            <div class="kpi-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
          </div>
        </div>

        <div class="kpi-card kpi-card-purple">
          <div class="kpi-top-row">
            <span class="kpi-label">Active Plan Subscribers</span>
          </div>
          <div class="kpi-bottom-row">
            <span class="kpi-value">{{ activeSubscriberCount() }}</span>
            <div class="kpi-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 3h12l4 6-10 12L2 9z"></path>
              </svg>
            </div>
          </div>
        </div>

        <div class="kpi-card kpi-card-green">
          <div class="kpi-top-row">
            <span class="kpi-label">Treatments Completed</span>
          </div>
          <div class="kpi-bottom-row">
            <span class="kpi-value">{{ totalCompletedTreatments() }}</span>
            <div class="kpi-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
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
    .patients-admin-page { padding: 0; min-width: 0; }
    .page-top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 14px; }
    .page-title { font-size: 22px; font-weight: 800; color: #0F172A; margin: 0 0 3px; letter-spacing: -0.02em; }
    .page-sub { font-size: 13px; color: #64748B; font-weight: 500; margin: 0; }
    .top-status-badge { display: inline-flex; align-items: center; gap: 6px; background: #DCFCE7; color: #166534; border: 1px solid #BBF7D0; padding: 5px 12px; border-radius: 999px; font-size: 11.5px; font-weight: 700; }
    .live-dot { width: 6px; height: 6px; border-radius: 50%; background: #16A34A; animation: pulse 1.5s infinite; }

    // KPI Cards (HealthHub Gradient Style)
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 22px; }
    .kpi-card { border-radius: 18px; padding: 18px 22px; box-shadow: 0 6px 20px rgba(15, 23, 42, 0.08); border: 1px solid rgba(255, 255, 255, 0.16); display: flex; flex-direction: column; justify-content: space-between; min-height: 114px; position: relative; overflow: hidden; box-sizing: border-box; color: #FFFFFF; transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.22s cubic-bezier(0.4, 0, 0.2, 1); }
    .kpi-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(15, 23, 42, 0.16); }
    .kpi-card.kpi-card-teal { background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); }
    .kpi-card.kpi-card-cyan, .kpi-card.kpi-card-blue { background: linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%); }
    .kpi-card.kpi-card-purple { background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%); }
    .kpi-card.kpi-card-green { background: linear-gradient(135deg, #059669 0%, #10B981 100%); }
    .kpi-top-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .kpi-label { font-size: 13.5px; color: rgba(255, 255, 255, 0.95); font-weight: 600; margin: 0; letter-spacing: 0.01em; }
    .kpi-bottom-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-top: 14px; }
    .kpi-value { font-size: 32px; font-weight: 800; color: #FFFFFF; line-height: 1; letter-spacing: -0.02em; }
    .kpi-icon-wrap { width: 44px; height: 44px; border-radius: 14px; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.3); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: transform 0.2s ease, background 0.2s ease; }
    .kpi-icon-wrap svg { width: 22px; height: 22px; stroke: #FFFFFF; }
    .kpi-card:hover .kpi-icon-wrap { transform: scale(1.08); background: rgba(255, 255, 255, 0.28); }

    // Controls
    .controls-panel { background: #FFFFFF; border-radius: 20px; padding: 14px 18px; display: flex; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; border: 1px solid rgba(226, 232, 240, 0.85); box-shadow: 0 10px 28px -4px rgba(15, 23, 42, 0.08), 0 4px 10px -2px rgba(15, 23, 42, 0.04); }
    .search-wrap { flex: 1; min-width: 250px; position: relative; display: flex; align-items: center; }
    .search-wrap svg { position: absolute; left: 14px; width: 17px; height: 17px; pointer-events: none; }
    .search-input { width: 100%; height: 40px; padding: 0 14px 0 40px; border: 1.5px solid #E2E8F0; border-radius: 10px; background: #F8FAFC; font-size: 13px; color: #0F172A; outline: none; transition: all 0.2s ease; }
    .search-input:focus { background: #FFFFFF; border-color: #0284C7; box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.12); }
    .filter-group { display: flex; align-items: center; gap: 8px; }
    .filter-lbl { font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.04em; }
    .filter-pill { background: #F8FAFC; border: 1.5px solid #E2E8F0; padding: 7px 15px; border-radius: 10px; font-size: 12.5px; font-weight: 600; color: #475569; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
    .filter-pill:hover { background: #F1F5F9; color: #0F172A; border-color: #CBD5E1; }
    .filter-pill.active { background: linear-gradient(135deg, #0284C7 0%, #0D9488 100%); color: #FFFFFF; border-color: transparent; font-weight: 700; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.28); }

    // Table
    .table-container-card { background: #FFFFFF; border-radius: 20px; box-shadow: 0 10px 28px -4px rgba(15, 23, 42, 0.08), 0 4px 10px -2px rgba(15, 23, 42, 0.04); border: 1px solid rgba(226, 232, 240, 0.85); overflow: hidden; }
    .table-responsive { overflow-x: auto; }
    .patients-table { width: 100%; border-collapse: collapse; text-align: left; }
    .patients-table thead tr { background: #F8FAFC; border-bottom: 1.5px solid #E2E8F0; }
    .patients-table th { padding: 14px 16px; font-size: 11.5px; font-weight: 700; text-transform: uppercase; color: #64748B; letter-spacing: 0.04em; white-space: nowrap; }
    .patients-table tbody tr { border-bottom: 1px solid #F1F5F9; transition: background 0.15s ease; }
    .patients-table tbody tr:hover { background: #F8FAFC; }
    .empty-icon-wrap { width: 52px; height: 52px; border-radius: 14px; background: #F1F5F9; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
    .empty-icon-wrap svg { width: 28px; height: 28px; }
    .patients-table td { padding: 14px 16px; font-size: 13px; color: #1E293B; vertical-align: middle; }

    .col-patient .patient-cell { display: flex; align-items: center; gap: 12px; }
    .avatar-bubble { width: 36px; height: 36px; border-radius: 10px; background: #E0F2FE; color: #0284C7; font-size: 13px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .patient-text { display: flex; flex-direction: column; gap: 1px; }
    .name { font-size: 13.5px; font-weight: 700; color: #0F172A; }
    .pid { font-size: 11px; color: #94A3B8; font-family: monospace; }

    .contact-pill { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; color: #334155; }
    .sub-plan-badge { background: #E0F2FE; color: #0284C7; padding: 4px 10px; border-radius: 8px; font-size: 11.5px; font-weight: 700; border: 1px solid #BAE6FD; white-space: nowrap; }
    .sub-plan-badge.badge-gold { background: #FEF3C7; color: #92400E; border-color: #FDE68A; }
    .no-sub-badge { color: #94A3B8; font-size: 12px; font-weight: 500; }

    .progress-block { display: flex; flex-direction: column; gap: 5px; min-width: 150px; }
    .prog-labels { display: flex; justify-content: space-between; font-size: 11.5px; }
    .remain-text { font-weight: 800; color: #0284C7; }
    .sub-ratio { color: #64748B; font-weight: 600; }
    .prog-track { width: 100%; height: 6px; background: #F1F5F9; border-radius: 999px; overflow: hidden; }
    .prog-fill { height: 100%; background: linear-gradient(90deg, #0D9488, #10B981); border-radius: 999px; }

    .completed-badge { background: #F1F5F9; color: #1E293B; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; }
    .reg-date { font-size: 12.5px; color: #64748B; font-weight: 500; }
    .text-muted { color: #CBD5E1; }

    .status-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; }
    .status-active { background: #DCFCE7; color: #15803D; border: 1px solid rgba(22, 163, 74, 0.2); }
    .status-walkin { background: #F1F5F9; color: #64748B; border: 1px solid #E2E8F0; }
    .pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: #16A34A; animation: pulse 1.5s infinite; }

    .empty-table-cell { padding: 40px 16px !important; text-align: center; }
    .empty-box { display: flex; flex-direction: column; align-items: center; }
    .empty-box h3 { font-size: 15px; font-weight: 800; color: #0F172A; margin: 0 0 4px; }
    .empty-box p { font-size: 12.5px; color: #64748B; margin: 0; }

    .loading-state { display: flex; flex-direction: column; align-items: center; padding: 48px 16px; gap: 12px; color: #64748B; }
    .spinner-ring { width: 28px; height: 28px; border: 2.5px solid #E2E8F0; border-top-color: #0284C7; border-radius: 50%; animation: spin 0.8s linear infinite; }

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
