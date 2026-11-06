import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Firestore, collection, query, where, onSnapshot, Unsubscribe } from '@angular/fire/firestore';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';
import { Session, calculateSessionEarning } from '../../core/models/session.model';

interface WorkerRow {
  uid: string;
  name: string;
  mobileNumber: string;
  specialization: string;
  experience: string;
  completedSessions: number;
  totalEarnings: number;
}

@Component({
  selector: 'app-admin-workers',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="workers-page animate-fade-in">
      <!-- Top Bar -->
      <div class="page-top-bar">
        <div>
          <h1 class="page-title">Workers & Physiotherapists</h1>
          <p class="page-sub">Manage clinic physiotherapists, track completed sessions, and monitor earnings</p>
        </div>
        <button class="btn btn-primary" (click)="openAddWorkerModal()" id="register-worker-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Register New Worker</span>
        </button>
      </div>

      <!-- KPI Overview Cards (HealthHub Gradient Style) -->
      <section class="kpi-grid">
        <div class="kpi-card kpi-card-teal">
          <div class="kpi-top-row">
            <span class="kpi-label">Total Physio Staff</span>
          </div>
          <div class="kpi-bottom-row">
            <span class="kpi-value">{{ workers().length }}</span>
            <div class="kpi-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <line x1="20" y1="8" x2="20" y2="14"></line>
                <line x1="23" y1="11" x2="17" y2="11"></line>
              </svg>
            </div>
          </div>
        </div>

        <div class="kpi-card kpi-card-green">
          <div class="kpi-top-row">
            <span class="kpi-label">Sessions Completed</span>
          </div>
          <div class="kpi-bottom-row">
            <span class="kpi-value">{{ totalCompletedSessions() }}</span>
            <div class="kpi-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
          </div>
        </div>

        <div class="kpi-card kpi-card-purple">
          <div class="kpi-top-row">
            <span class="kpi-label">Total Staff Earnings</span>
          </div>
          <div class="kpi-bottom-row">
            <span class="kpi-value">₹{{ totalStaffEarnings().toLocaleString('en-IN') }}</span>
            <div class="kpi-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
          </div>
        </div>
      </section>

      <!-- Search & Filter Controls -->
      <div class="controls-panel">
        <div class="search-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="search"
            placeholder="Search worker name, specialization, phone..."
            [value]="searchQuery()"
            (input)="searchQuery.set($any($event.target).value)"
            class="search-input"
            id="worker-search-input"
          />
        </div>

        <div class="filter-group">
          <span class="filter-lbl">Specialization:</span>
          <select [ngModel]="selectedSpec()" (ngModelChange)="selectedSpec.set($event)" class="spec-select">
            <option value="All">All Specializations</option>
            @for (spec of specializations; track spec) {
              <option [value]="spec">{{ spec }}</option>
            }
          </select>
        </div>
      </div>

      <!-- Workers Table View (Converted from Cards) -->
      <div class="table-container-card">
        @if (isLoading()) {
          <div class="loading-state">
            <div class="spinner-ring"></div>
            <p>Loading physiotherapists...</p>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="workers-table">
              <thead>
                <tr>
                  <th>Physiotherapist</th>
                  <th>Contact</th>
                  <th>Specialization</th>
                  <th>Experience</th>
                  <th>Sessions Completed</th>
                  <th>Total Earnings</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (worker of filteredWorkers(); track worker.uid || worker.mobileNumber) {
                  <tr class="table-row" [id]="'worker-row-' + worker.uid">
                    <!-- Physio Info -->
                    <td class="col-physio">
                      <div class="physio-cell">
                        <div class="worker-avatar">
                          {{ (worker.name || 'W').charAt(0).toUpperCase() }}
                        </div>
                        <div class="worker-name-block">
                          <strong class="w-name">{{ worker.name }}</strong>
                          <span class="w-id">ID: {{ worker.uid ? worker.uid.slice(0, 8) : 'staff' }}</span>
                        </div>
                      </div>
                    </td>

                    <!-- Contact -->
                    <td class="col-contact">
                      <span class="contact-pill">+91 {{ worker.mobileNumber }}</span>
                    </td>

                    <!-- Specialization -->
                    <td class="col-spec">
                      <span class="spec-badge">{{ worker.specialization || 'Physiotherapist' }}</span>
                    </td>

                    <!-- Experience -->
                    <td class="col-exp">
                      <span class="exp-text">{{ worker.experience || '3 Years' }}</span>
                    </td>

                    <!-- Completed Sessions -->
                    <td class="col-sessions">
                      <span class="sess-count-badge">{{ worker.completedSessions }} Sessions</span>
                    </td>

                    <!-- Total Earnings -->
                    <td class="col-earnings">
                      <span class="earnings-val">₹{{ worker.totalEarnings.toLocaleString('en-IN') }}</span>
                    </td>

                    <!-- Status -->
                    <td class="col-status">
                      <span class="status-pill status-active">
                        <span class="pulse-dot"></span>
                        Active Staff
                      </span>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="empty-table-cell">
                      <div class="empty-workers-box">
                        <div class="empty-icon-wrap">
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="8.5" cy="7" r="4"></circle>
                          </svg>
                        </div>
                        <h3>No Physiotherapists Found</h3>
                        <p>No workers match your current search or filter criteria.</p>
                        <button class="btn btn-primary" (click)="openAddWorkerModal()" style="margin-top: 14px;">
                          Register First Worker
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <!-- Add Worker Modal -->
      @if (showAddWorkerModal()) {
        <div class="modal-overlay" (click)="closeAddWorkerModal()">
          <div class="worker-modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <h2 class="modal-title">Register New Worker / Physio</h2>
                <p class="modal-sub">Create worker staff account in Walk In Physio</p>
              </div>
              <button class="btn-close" (click)="closeAddWorkerModal()">✕</button>
            </div>

            @if (workerModalSuccess()) {
              <div class="alert-success animate-fade-in">
                <span>✓ {{ workerModalSuccess() }}</span>
              </div>
            }

            @if (workerModalError()) {
              <div class="alert-error animate-fade-in">
                <span>⚠️ {{ workerModalError() }}</span>
              </div>
            }

            <form [formGroup]="workerForm" (ngSubmit)="submitNewWorker()" class="modal-form">
              <div class="form-group">
                <label class="form-label">Full Name *</label>
                <input type="text" formControlName="name" placeholder="e.g. Dr. Rahul Sharma" class="modal-input" />
              </div>

              <div class="form-group">
                <label class="form-label">Mobile Number *</label>
                <div class="input-with-prefix">
                  <span class="prefix">+91</span>
                  <input type="tel" formControlName="phone" placeholder="10-digit mobile" maxlength="10" class="modal-input" />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group flex-1">
                  <label class="form-label">Specialization *</label>
                  <select formControlName="specialization" class="modal-select">
                    @for (spec of specializations; track spec) {
                      <option [value]="spec">{{ spec }}</option>
                    }
                  </select>
                </div>

                <div class="form-group flex-1">
                  <label class="form-label">Experience *</label>
                  <input type="text" formControlName="experience" placeholder="e.g. 4 Years" class="modal-input" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Assign 4-Digit M-PIN *</label>
                <input type="password" formControlName="pin" placeholder="4-digit PIN (e.g. 1234)" maxlength="4" inputmode="numeric" class="modal-input" />
                <span class="field-hint">Worker will use this PIN to log in on their mobile.</span>
              </div>

              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" (click)="closeAddWorkerModal()">Cancel</button>
                <button type="submit" class="btn btn-primary" [disabled]="isSubmittingWorker() || workerForm.invalid">
                  @if (isSubmittingWorker()) {
                    <span>Creating Account...</span>
                  } @else {
                    <span>Save & Register Worker</span>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .workers-page { padding: 0; min-width: 0; }
    .page-top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 14px; }
    .page-title { font-size: 22px; font-weight: 800; color: #0F172A; margin: 0 0 3px; letter-spacing: -0.02em; }
    .page-sub { font-size: 13px; color: #64748B; font-weight: 500; margin: 0; }
    .btn { padding: 9px 18px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; border: none; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
    .btn-primary { background: linear-gradient(135deg, #0284C7 0%, #0D9488 100%); color: white; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.28); }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(2, 132, 199, 0.38); }
    .btn-secondary { background: #F1F5F9; color: #475569; border: 1px solid #E2E8F0; }
    .btn-secondary:hover { background: #E2E8F0; color: #0F172A; }

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

    // Controls Panel
    .controls-panel { background: #FFFFFF; border-radius: 18px; padding: 14px 18px; display: flex; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; border: 1px solid rgba(226, 232, 240, 0.85); box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04); }
    .search-wrap { flex: 1; min-width: 250px; position: relative; display: flex; align-items: center; }
    .search-wrap svg { position: absolute; left: 14px; width: 17px; height: 17px; pointer-events: none; }
    .search-input { width: 100%; height: 40px; padding: 0 14px 0 40px; border: 1.5px solid #E2E8F0; border-radius: 10px; background: #F8FAFC; font-size: 13px; color: #0F172A; outline: none; transition: all 0.2s ease; }
    .search-input:focus { background: #FFFFFF; border-color: #0284C7; box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.12); }
    .filter-group { display: flex; align-items: center; gap: 8px; }
    .filter-lbl { font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.04em; }
    .spec-select { height: 40px; border-radius: 10px; border: 1.5px solid #E2E8F0; background: #F8FAFC; padding: 0 14px; font-size: 13px; font-weight: 600; color: #0F172A; outline: none; cursor: pointer; transition: all 0.2s ease; }
    .spec-select:focus { border-color: #0284C7; background: #FFFFFF; }

    // Table
    .table-container-card { background: #FFFFFF; border-radius: 18px; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04); border: 1px solid rgba(226, 232, 240, 0.85); overflow: hidden; }
    .table-responsive { overflow-x: auto; }
    .workers-table { width: 100%; border-collapse: collapse; text-align: left; }
    .workers-table thead tr { background: #F8FAFC; border-bottom: 1.5px solid #E2E8F0; }
    .workers-table th { padding: 14px 16px; font-size: 11.5px; font-weight: 700; text-transform: uppercase; color: #64748B; letter-spacing: 0.04em; white-space: nowrap; }
    .workers-table tbody tr { border-bottom: 1px solid #F1F5F9; transition: background 0.15s ease; }
    .workers-table tbody tr:hover { background: #F8FAFC; }
    .empty-icon-wrap { width: 52px; height: 52px; border-radius: 14px; background: #F1F5F9; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
    .empty-icon-wrap svg { width: 28px; height: 28px; }
    .workers-table td { padding: 14px 16px; font-size: 13px; color: #1E293B; vertical-align: middle; }

    .col-physio .physio-cell { display: flex; align-items: center; gap: 12px; }
    .worker-avatar { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #0284C7 0%, #0D9488 100%); color: white; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; flex-shrink: 0; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.25); }
    .worker-name-block { display: flex; flex-direction: column; gap: 1px; }
    .w-name { font-size: 13.5px; font-weight: 700; color: #0F172A; }
    .w-id { font-size: 11px; color: #94A3B8; font-family: monospace; }

    .contact-pill { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; color: #334155; }
    .spec-badge { background: #E0F2FE; color: #0284C7; padding: 4px 10px; border-radius: 8px; font-size: 11.5px; font-weight: 700; border: 1px solid #BAE6FD; white-space: nowrap; }
    .exp-text { font-size: 12.5px; font-weight: 500; color: #475569; }
    .sess-count-badge { background: #FEF3C7; color: #92400E; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; border: 1px solid #FDE68A; }
    .earnings-val { font-size: 14px; font-weight: 800; color: #16A34A; }

    .status-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; background: #DCFCE7; color: #15803D; border: 1px solid rgba(22, 163, 74, 0.2); }
    .pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: #16A34A; animation: pulse 1.5s infinite; }

    .empty-table-cell { padding: 40px 16px !important; text-align: center; }
    .empty-workers-box { display: flex; flex-direction: column; align-items: center; }
    .empty-workers-box h3 { font-size: 15px; font-weight: 800; color: #0F172A; margin: 0 0 4px; }
    .empty-workers-box p { font-size: 12.5px; color: #64748B; margin: 0; }

    .loading-state { display: flex; flex-direction: column; align-items: center; padding: 48px 16px; gap: 12px; color: #64748B; }
    .spinner-ring { width: 28px; height: 28px; border: 2.5px solid #E2E8F0; border-top-color: #0284C7; border-radius: 50%; animation: spin 0.8s linear infinite; }

    // Modal
    .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(5px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box; }
    .worker-modal { position: relative; width: 100%; max-width: 440px; max-height: calc(100vh - 40px); overflow-y: auto; background: white; border-radius: 20px; padding: 24px; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.2); border: 1px solid rgba(226, 232, 240, 0.8); z-index: 10000; display: flex; flex-direction: column; box-sizing: border-box; }
    .modal-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .modal-title { font-size: 17px; font-weight: 800; color: #0F172A; margin: 0 0 2px; }
    .modal-sub { font-size: 12px; color: #64748B; margin: 0; }
    .btn-close { width: 32px; height: 32px; border-radius: 50%; border: none; background: #F1F5F9; cursor: pointer; color: #64748B; font-weight: 700; transition: all 0.15s ease; &:hover { background: #E2E8F0; color: #0F172A; } }
    .alert-success { background: #DCFCE7; color: #166534; padding: 8px 12px; border-radius: 10px; font-size: 12px; font-weight: 600; margin-bottom: 12px; border: 1px solid #BBF7D0; }
    .alert-error { background: #FEE2E2; color: #DC2626; padding: 8px 12px; border-radius: 10px; font-size: 12px; font-weight: 600; margin-bottom: 12px; border: 1px solid #FECACA; }
    .modal-form { display: flex; flex-direction: column; gap: 12px; }
    .form-group { display: flex; flex-direction: column; gap: 4px; }
    .form-row { display: flex; gap: 10px; }
    .flex-1 { flex: 1; min-width: 0; }
    .form-label { font-size: 12px; font-weight: 700; color: #0F172A; }
    .modal-input, .modal-select { width: 100%; height: 38px; padding: 0 12px; border: 1.5px solid #E2E8F0; border-radius: 10px; background: #F8FAFC; font-size: 13px; color: #0F172A; outline: none; transition: all 0.2s ease; }
    .modal-input:focus, .modal-select:focus { border-color: #0284C7; background: white; box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.12); }
    .input-with-prefix { display: flex; align-items: center; background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 10px; padding: 0 10px; height: 38px; transition: all 0.2s ease; }
    .input-with-prefix:focus-within { border-color: #0284C7; background: white; box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.12); }
    .prefix { font-weight: 700; font-size: 13px; color: #64748B; margin-right: 8px; padding-right: 8px; border-right: 1px solid #CBD5E1; }
    .input-with-prefix .modal-input { border: none; padding: 0; background: transparent; box-shadow: none; }
    .field-hint { font-size: 11px; color: #94A3B8; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; }

    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0% { transform: scale(0.95); opacity: 0.8; } 50% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(0.95); opacity: 0.8; } }
  `]
})
export class AdminWorkersComponent implements OnInit, OnDestroy {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  private usersUnsub: Unsubscribe | null = null;
  private sessionsUnsub: Unsubscribe | null = null;

  workers = signal<User[]>([]);
  workerStatsMap = signal<Record<string, { count: number; earnings: number }>>({});
  isLoading = signal<boolean>(true);

  searchQuery = signal<string>('');
  selectedSpec = signal<string>('All');

  showAddWorkerModal = signal<boolean>(false);
  isSubmittingWorker = signal<boolean>(false);
  workerModalError = signal<string>('');
  workerModalSuccess = signal<string>('');

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

  workerRows = computed<WorkerRow[]>(() => {
    const stats = this.workerStatsMap();
    return this.workers().map(w => {
      const s = stats[w.uid] || (w.mobileNumber ? stats[w.mobileNumber] : null) || { count: w.completedSessions || 0, earnings: Number(w.totalEarnings) || 0 };
      return {
        uid: w.uid,
        name: w.name,
        mobileNumber: w.mobileNumber,
        specialization: w.specialization || 'Orthopedic Physiotherapy',
        experience: w.experience || '3 Years',
        completedSessions: Math.max(w.completedSessions || 0, s.count),
        totalEarnings: Math.max(Number(w.totalEarnings) || 0, s.earnings)
      };
    });
  });

  totalCompletedSessions = computed(() =>
    this.workerRows().reduce((sum, w) => sum + w.completedSessions, 0)
  );

  totalStaffEarnings = computed(() =>
    this.workerRows().reduce((sum, w) => sum + w.totalEarnings, 0)
  );

  filteredWorkers = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const spec = this.selectedSpec();

    return this.workerRows().filter(w => {
      const nameMatch = (w.name || '').toLowerCase().includes(q);
      const phoneMatch = (w.mobileNumber || '').includes(q);
      const specMatchText = (w.specialization || '').toLowerCase().includes(q);
      const matchesSearch = !q || nameMatch || phoneMatch || specMatchText;

      const matchesSpec = spec === 'All' || w.specialization === spec;
      return matchesSearch && matchesSpec;
    });
  });

  ngOnInit() {
    this.listenToUsersAndSessions();
  }

  ngOnDestroy() {
    this.usersUnsub?.();
    this.sessionsUnsub?.();
  }

  private listenToUsersAndSessions() {
    // 1. Listen to workers in users collection
    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where('role', '==', 'worker'));
    this.usersUnsub = onSnapshot(q, (snapshot) => {
      const list: User[] = [];
      snapshot.forEach(docSnap => {
        list.push({ ...(docSnap.data() as User), uid: docSnap.id });
      });
      this.workers.set(list);
      this.isLoading.set(false);
    }, () => this.isLoading.set(false));

    // 2. Listen to sessions collection to compute live completed sessions & earnings for each worker
    const sessionsRef = collection(this.firestore, 'sessions');
    this.sessionsUnsub = onSnapshot(sessionsRef, (snapshot) => {
      const stats: Record<string, { count: number; earnings: number }> = {};
      snapshot.forEach(docSnap => {
        const s = docSnap.data() as Session;
        if (s.status === 'completed' && s.workerId) {
          if (!stats[s.workerId]) {
            stats[s.workerId] = { count: 0, earnings: 0 };
          }
          stats[s.workerId].count++;
          stats[s.workerId].earnings += calculateSessionEarning(s);
        }
      });
      this.workerStatsMap.set(stats);
    });
  }

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
      await this.authService.createWorkerFromAdmin({ name, phone, pin, specialization, experience });
      this.isSubmittingWorker.set(false);
      this.workerModalSuccess.set(`Worker "${name}" successfully registered!`);
      setTimeout(() => this.closeAddWorkerModal(), 1800);
    } catch (e: any) {
      this.isSubmittingWorker.set(false);
      this.workerModalError.set(e.message || 'Failed to create worker account.');
    }
  }
}
