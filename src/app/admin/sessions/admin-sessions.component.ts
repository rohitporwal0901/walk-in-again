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

        <!-- Date Filtering Dropdown in Top Bar (Replaces static sync badge) -->
        <div class="top-date-filter-wrap">
          <div class="top-date-selector">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="date-icon">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <select
              class="top-date-select"
              [value]="selectedDateFilter()"
              (change)="onDateFilterChange($any($event.target).value)"
              id="session-date-filter-select"
            >
              <option value="All">All Dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="chevron-icon">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>

          @if (selectedDateFilter() === 'custom') {
            <div class="top-custom-date-wrap">
              <input
                type="date"
                class="top-custom-date-input"
                [value]="customStartDate()"
                (input)="onCustomStartDate($any($event.target).value)"
              />
              <span class="date-sep">to</span>
              <input
                type="date"
                class="top-custom-date-input"
                [value]="customEndDate()"
                (input)="onCustomEndDate($any($event.target).value)"
              />
            </div>
          }
        </div>
      </header>

      <!-- KPI Summary Cards (HealthHub Gradient Style) -->
      <section class="kpi-grid">
        <div class="kpi-card kpi-card-teal">
          <div class="kpi-top-row">
            <span class="kpi-label">Total Sessions</span>
          </div>
          <div class="kpi-bottom-row">
            <span class="kpi-value">{{ totalSessionsCount() }}</span>
            <div class="kpi-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              </svg>
            </div>
          </div>
        </div>

        <div class="kpi-card kpi-card-green">
          <div class="kpi-top-row">
            <span class="kpi-label">Active In Clinic</span>
          </div>
          <div class="kpi-bottom-row">
            <span class="kpi-value">{{ activeSessionsCount() }}</span>
            <div class="kpi-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
            </div>
          </div>
        </div>

        <div class="kpi-card kpi-card-purple">
          <div class="kpi-top-row">
            <span class="kpi-label">Completed Sessions</span>
          </div>
          <div class="kpi-bottom-row">
            <span class="kpi-value">{{ completedSessionsCount() }}</span>
            <div class="kpi-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
          </div>
        </div>

        <div class="kpi-card kpi-card-blue">
          <div class="kpi-top-row">
            <span class="kpi-label">Total Session Value</span>
          </div>
          <div class="kpi-bottom-row">
            <span class="kpi-value">₹{{ totalSessionValue().toLocaleString('en-IN') }}</span>
            <div class="kpi-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 5H7h3a4 4 0 0 1 0 8H7l6 6M7 9h11"></path>
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
            placeholder="Search patient, physiotherapist, session ID..."
            [value]="searchQuery()"
            (input)="onSearch($any($event.target).value)"
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
              (click)="onStatusChange(f)"
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
              (click)="onTypeChange(t)"
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
                  <th>Value</th>
                  <th>Status</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                @for (sess of paginatedSessions(); track sess.id || $index) {
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
                    <td colspan="7" class="empty-table-cell">
                      <div class="empty-box">
                        <div class="empty-icon-wrap">
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
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

          <!-- Pagination Bar -->
          @if (filteredSessions().length > 0) {
            <div class="pagination-bar">
              <div class="pagination-info">
                Showing <strong>{{ startIndex() }}</strong>–<strong>{{ endIndex() }}</strong> of <strong>{{ totalItems() }}</strong> sessions
              </div>

              <div class="pagination-actions">
                <!-- Page Size Dropdown -->
                <div class="page-size-selector">
                  <label for="sess-page-size-select">Per page:</label>
                  <select
                    id="sess-page-size-select"
                    [value]="pageSize()"
                    (change)="setPageSize(+($any($event.target).value))"
                    class="page-size-dropdown"
                  >
                    <option [value]="5">5</option>
                    <option [value]="10">10</option>
                    <option [value]="20">20</option>
                    <option [value]="50">50</option>
                  </select>
                </div>

                <!-- Navigation Buttons -->
                <div class="page-nav-btns">
                  <button
                    type="button"
                    class="page-nav-btn"
                    [disabled]="currentPage() === 1"
                    (click)="prevPage()"
                    aria-label="Previous page"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                    <span>Prev</span>
                  </button>

                  <div class="page-numbers">
                    @for (p of getPageNumbers(); track $index) {
                      @if (p === '...') {
                        <span class="page-ellipsis">…</span>
                      } @else {
                        <button
                          type="button"
                          class="page-num-btn"
                          [class.active]="currentPage() === p"
                          (click)="setPage(+p)"
                        >
                          {{ p }}
                        </button>
                      }
                    }
                  </div>

                  <button
                    type="button"
                    class="page-nav-btn"
                    [disabled]="currentPage() === totalPages()"
                    (click)="nextPage()"
                    aria-label="Next page"
                  >
                    <span>Next</span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          }
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

    .top-date-filter-wrap {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;

      .top-date-selector {
        position: relative;
        display: inline-flex;
        align-items: center;

        .date-icon {
          position: absolute;
          left: 12px;
          color: #0D9488;
          pointer-events: none;
        }

        .chevron-icon {
          position: absolute;
          right: 12px;
          color: #64748B;
          pointer-events: none;
        }

        .top-date-select {
          height: 36px;
          appearance: none;
          -webkit-appearance: none;
          padding: 0 32px 0 36px;
          border-radius: 999px;
          border: 1px solid #E2E8F0;
          background: #FFFFFF;
          color: #0F172A;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          outline: none;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
          transition: all 0.2s ease;

          &:hover {
            background: #F8FAFC;
            border-color: #CBD5E1;
          }

          &:focus {
            background: #FFFFFF;
            border-color: #0D9488;
            box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15);
          }
        }
      }

      .top-custom-date-wrap {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #FFFFFF;
        padding: 4px 12px;
        border-radius: 999px;
        border: 1px solid #E2E8F0;
        box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);

        .date-sep {
          font-size: 11px;
          font-weight: 700;
          color: #64748B;
          text-transform: uppercase;
        }

        .top-custom-date-input {
          height: 26px;
          padding: 0 4px;
          border: none;
          background: transparent;
          color: #0F172A;
          font-size: 11.5px;
          font-weight: 600;
          outline: none;
        }
      }
    }

    // KPI Cards Grid (Matches HealthHub Gradient Design)
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 22px;
    }

    .kpi-card {
      border-radius: 18px;
      padding: 18px 22px;
      box-shadow: 0 6px 20px rgba(15, 23, 42, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.16);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 114px;
      position: relative;
      overflow: hidden;
      box-sizing: border-box;
      color: #FFFFFF;
      transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.22s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        transform: translateY(-3px);
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.16);
      }

      &.kpi-card-teal {
        background: linear-gradient(135deg, #14B8A6 0%, #0D9488 100%);
      }
      &.kpi-card-green {
        background: linear-gradient(135deg, #10B981 0%, #059669 100%);
      }
      &.kpi-card-purple {
        background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
      }
      &.kpi-card-blue, &.kpi-card-cyan {
        background: linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%);
      }
    }

    .kpi-top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .kpi-label {
      font-size: 13.5px;
      color: rgba(255, 255, 255, 0.95);
      font-weight: 600;
      margin: 0;
      letter-spacing: 0.01em;
    }

    .kpi-bottom-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
      margin-top: 14px;
    }

    .kpi-value {
      font-size: 32px;
      font-weight: 800;
      color: #FFFFFF;
      line-height: 1;
      letter-spacing: -0.02em;
    }

    .kpi-icon-wrap {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: transform 0.2s ease, background 0.2s ease;

      svg {
        width: 22px;
        height: 22px;
        stroke: #FFFFFF;
      }
    }

    .kpi-card:hover .kpi-icon-wrap {
      transform: scale(1.08);
      background: rgba(255, 255, 255, 0.28);
    }

    // Controls Panel
    .controls-panel {
      background: #FFFFFF;
      border-radius: 20px;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 20px;
      border: 1px solid rgba(226, 232, 240, 0.85);
      box-shadow: 0 10px 28px -4px rgba(15, 23, 42, 0.08), 0 4px 10px -2px rgba(15, 23, 42, 0.04);
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

    // Date Filter Dropdown Styles
    .date-filter-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .date-dropdown-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;

      .date-icon {
        position: absolute;
        left: 12px;
        color: #0284C7;
        pointer-events: none;
      }

      .chevron-icon {
        position: absolute;
        right: 12px;
        color: #64748B;
        pointer-events: none;
      }

      .date-select {
        height: 38px;
        appearance: none;
        -webkit-appearance: none;
        padding: 0 32px 0 36px;
        border-radius: 10px;
        border: 1.5px solid #E2E8F0;
        background: #F8FAFC;
        color: #0F172A;
        font-size: 12.5px;
        font-weight: 700;
        cursor: pointer;
        outline: none;
        transition: all 0.2s ease;

        &:focus {
          border-color: #0284C7;
          background: #FFFFFF;
          box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.12);
        }

        &:hover {
          border-color: #CBD5E1;
          background: #F1F5F9;
        }
      }
    }

    .custom-date-wrap {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      animation: fadeIn 0.2s ease;

      .date-sep {
        font-size: 12px;
        font-weight: 700;
        color: #64748B;
        text-transform: uppercase;
      }

      .custom-date-input {
        height: 38px;
        padding: 0 10px;
        border: 1.5px solid #E2E8F0;
        border-radius: 10px;
        background: #F8FAFC;
        color: #0F172A;
        font-size: 12px;
        font-weight: 600;
        outline: none;
        transition: all 0.2s ease;

        &:focus {
          border-color: #0284C7;
          background: #FFFFFF;
          box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.12);
        }
      }
    }

    // ─── Pagination Bar ──────────────────────────────────────────────
    .pagination-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      background: #FFFFFF;
      border-top: 1.5px solid #F1F5F9;
      flex-wrap: wrap;
      gap: 14px;

      .pagination-info {
        font-size: 13px;
        color: #64748B;
        strong {
          color: #0F172A;
          font-weight: 700;
        }
      }

      .pagination-actions {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;

        .page-size-selector {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12.5px;
          color: #64748B;
          font-weight: 600;

          .page-size-dropdown {
            height: 32px;
            padding: 0 10px;
            border-radius: 8px;
            border: 1.5px solid #E2E8F0;
            background: #F8FAFC;
            color: #0F172A;
            font-size: 12.5px;
            font-weight: 600;
            outline: none;
            cursor: pointer;
            transition: all 0.2s ease;

            &:focus {
              border-color: #0284C7;
              box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.12);
            }
          }
        }

        .page-nav-btns {
          display: flex;
          align-items: center;
          gap: 6px;

          .page-nav-btn {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            height: 32px;
            padding: 0 12px;
            border-radius: 8px;
            border: 1.5px solid #E2E8F0;
            background: #F8FAFC;
            color: #334155;
            font-size: 12.5px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.18s ease;

            &:hover:not(:disabled) {
              background: #0284C7;
              border-color: #0284C7;
              color: #FFFFFF;
              box-shadow: 0 2px 8px rgba(2, 132, 199, 0.25);
            }

            &:disabled {
              opacity: 0.45;
              cursor: not-allowed;
              background: #F8FAFC;
              color: #94A3B8;
            }
          }

          .page-numbers {
            display: flex;
            align-items: center;
            gap: 4px;

            .page-ellipsis {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 32px;
              height: 32px;
              color: #94A3B8;
              font-weight: 700;
              font-size: 13px;
            }

            .page-num-btn {
              min-width: 32px;
              height: 32px;
              padding: 0 6px;
              border-radius: 8px;
              border: 1.5px solid #E2E8F0;
              background: #F8FAFC;
              color: #334155;
              font-size: 12.5px;
              font-weight: 700;
              cursor: pointer;
              transition: all 0.18s ease;

              &:hover:not(.active) {
                background: #E2E8F0;
                color: #0F172A;
              }

              &.active {
                background: linear-gradient(135deg, #0284C7 0%, #0D9488 100%);
                border-color: transparent;
                color: #FFFFFF;
                box-shadow: 0 2px 8px rgba(2, 132, 199, 0.3);
              }
            }
          }
        }
      }
    }

    // Table
    .table-container-card {
      background: #FFFFFF;
      border-radius: 20px;
      box-shadow: 0 10px 28px -4px rgba(15, 23, 42, 0.08), 0 4px 10px -2px rgba(15, 23, 42, 0.04);
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
      border: 1px solid #BAE6FD;
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
      border: 1px solid #E2E8F0;
      color: #64748B;
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

    // ─── Scoped Dark Theme Overrides ──────────────────────────────────────
    :host-context(.admin-dark-theme) {
      .page-title { color: #F8FAFC !important; }
      .page-sub   { color: #94A3B8 !important; }

      .top-date-filter-wrap {
        .top-date-selector {
          .date-icon { color: #00D2B4 !important; }
          .chevron-icon { color: #94A3B8 !important; }
          .top-date-select {
            background: #131E35 !important;
            border-color: #243656 !important;
            color: #F8FAFC !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25) !important;

            &:hover {
              background: #192744 !important;
              border-color: #00D2B4 !important;
            }

            &:focus {
              background: #131E35 !important;
              border-color: #00D2B4 !important;
              box-shadow: 0 0 0 3px rgba(0, 210, 180, 0.25) !important;
            }

            option {
              background: #0F172A;
              color: #F8FAFC;
            }
          }
        }

        .top-custom-date-wrap {
          background: #131E35 !important;
          border-color: #243656 !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25) !important;
          .date-sep { color: #94A3B8 !important; }
          .top-custom-date-input {
            color: #F8FAFC !important;
            color-scheme: dark;
          }
        }
      }

      .controls-panel {
        background: #131E35 !important;
        border-color: #1E2D48 !important;
        box-shadow: 0 10px 28px -4px rgba(0, 0, 0, 0.5) !important;
      }

      .search-wrap svg {
        stroke: #64748B !important;
      }

      .search-input {
        background: #0F172A !important;
        border-color: #1E2D48 !important;
        color: #F8FAFC !important;
        &::placeholder { color: #64748B !important; }
        &:focus {
          background: #131E35 !important;
          border-color: #0284C7 !important;
          box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.25) !important;
        }
      }

      .filter-lbl { color: #94A3B8 !important; }

      .filter-pill {
        background: #0F172A !important;
        border-color: #1E2D48 !important;
        color: #94A3B8 !important;

        &:hover {
          background: #192744 !important;
          color: #F8FAFC !important;
          border-color: #243656 !important;
        }

        &.active {
          background: linear-gradient(135deg, #0284C7 0%, #0D9488 100%) !important;
          color: #FFFFFF !important;
          border-color: transparent !important;
          box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35) !important;
        }
      }

      .table-container-card {
        background: #131E35 !important;
        border-color: #1E2D48 !important;
        box-shadow: 0 10px 28px -4px rgba(0, 0, 0, 0.5) !important;
      }

      .sessions-table thead tr {
        background: #0F172A !important;
        border-bottom-color: #1E2D48 !important;
      }

      .sessions-table th {
        color: #94A3B8 !important;
      }

      .sessions-table tbody tr {
        border-bottom-color: #1A2740 !important;
        background: transparent !important;

        &:hover {
          background: #182642 !important;
        }
      }

      .sessions-table td {
        color: #CBD5E1 !important;
      }

      .session-id { color: #38BDF8 !important; }
      .session-date { color: #94A3B8 !important; }

      .patient-avatar {
        background: rgba(2, 132, 199, 0.2) !important;
        color: #38BDF8 !important;
        border-color: rgba(56, 189, 248, 0.3) !important;
      }

      .p-name { color: #F8FAFC !important; }
      .p-phone { color: #94A3B8 !important; }

      .worker-pill {
        background: #0F172A !important;
        border-color: #1E2D48 !important;
        color: #E2E8F0 !important;

        .worker-dot {
          background: #38BDF8 !important;
        }
      }

      .plan-badge {
        background: rgba(139, 92, 246, 0.18) !important;
        color: #C4B5FD !important;
        border-color: rgba(139, 92, 246, 0.35) !important;
      }

      .walkin-badge {
        background: #0F172A !important;
        color: #94A3B8 !important;
        border-color: #1E2D48 !important;
      }

      .fee-text { color: #F8FAFC !important; }

      .status-badge {
        &.status-completed {
          background: rgba(16, 185, 129, 0.18) !important;
          color: #34D399 !important;
          border-color: rgba(52, 211, 153, 0.3) !important;
          .dot { background: #34D399 !important; }
        }

        &.status-active {
          background: rgba(2, 132, 199, 0.18) !important;
          color: #38BDF8 !important;
          border-color: rgba(56, 189, 248, 0.3) !important;
          .dot { background: #38BDF8 !important; }
        }

        &.status-pending {
          background: rgba(245, 158, 11, 0.18) !important;
          color: #FBBF24 !important;
          border-color: rgba(251, 191, 36, 0.3) !important;
          .dot { background: #FBBF24 !important; }
        }

        &.status-cancelled {
          background: rgba(239, 68, 68, 0.18) !important;
          color: #F87171 !important;
          border-color: rgba(248, 113, 113, 0.3) !important;
          .dot { background: #F87171 !important; }
        }
      }

      .pay-badge {
        &.pay-paid {
          background: rgba(16, 185, 129, 0.18) !important;
          color: #34D399 !important;
          border-color: rgba(52, 211, 153, 0.3) !important;
        }

        &.pay-plan {
          background: rgba(139, 92, 246, 0.18) !important;
          color: #C4B5FD !important;
          border-color: rgba(139, 92, 246, 0.35) !important;
        }

        &.pay-unpaid {
          background: rgba(245, 158, 11, 0.18) !important;
          color: #FBBF24 !important;
          border-color: rgba(251, 191, 36, 0.3) !important;
        }
      }

      .empty-box {
        .empty-icon-wrap {
          background: #0F172A !important;
          border-color: #1E2D48 !important;
          color: #38BDF8 !important;

          svg {
            stroke: #38BDF8 !important;
          }
        }

        h3 { color: #F8FAFC !important; }
        p  { color: #94A3B8 !important; }
      }

      .loading-state {
        color: #94A3B8 !important;
        p { color: #94A3B8 !important; }
        .spinner-ring {
          border-color: #1E2D48 !important;
          border-top-color: #38BDF8 !important;
        }
      }

      .date-dropdown-wrap {
        .date-icon { color: #38BDF8 !important; }
        .chevron-icon { color: #94A3B8 !important; }
        .date-select {
          background: #0F172A !important;
          border-color: #1E2D48 !important;
          color: #F8FAFC !important;
          &:hover {
            background: #192744 !important;
            border-color: #243656 !important;
          }
          &:focus {
            background: #131E35 !important;
            border-color: #0284C7 !important;
            box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.25) !important;
          }
        }
      }

      .custom-date-wrap {
        .date-sep { color: #94A3B8 !important; }
        .custom-date-input {
          background: #0F172A !important;
          border-color: #1E2D48 !important;
          color: #F8FAFC !important;
          &:focus {
            background: #131E35 !important;
            border-color: #0284C7 !important;
            box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.25) !important;
          }
        }
      }

      .pagination-bar {
        background: #0F172A !important;
        border-top-color: #1E2D48 !important;

        .pagination-info {
          color: #94A3B8 !important;
          strong { color: #F8FAFC !important; }
        }

        .pagination-actions {
          .page-size-selector {
            color: #94A3B8 !important;
            .page-size-dropdown {
              background: #131E35 !important;
              border-color: #1E2D48 !important;
              color: #F8FAFC !important;
              &:focus {
                border-color: #0284C7 !important;
                box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.25) !important;
              }
            }
          }

          .page-nav-btns {
            .page-nav-btn {
              background: #131E35 !important;
              border-color: #1E2D48 !important;
              color: #CBD5E1 !important;

              &:hover:not(:disabled) {
                background: #0284C7 !important;
                border-color: #0284C7 !important;
                color: #FFFFFF !important;
              }

              &:disabled {
                background: #131E35 !important;
                border-color: #1A2740 !important;
                color: #475569 !important;
              }
            }

            .page-numbers {
              .page-ellipsis { color: #64748B !important; }

              .page-num-btn {
                background: #131E35 !important;
                border-color: #1E2D48 !important;
                color: #CBD5E1 !important;

                &:hover:not(.active) {
                  background: #1E2D48 !important;
                  color: #F8FAFC !important;
                }

                &.active {
                  background: linear-gradient(135deg, #0284C7 0%, #0D9488 100%) !important;
                  border-color: transparent !important;
                  color: #FFFFFF !important;
                }
              }
            }
          }
        }
      }
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
  selectedDateFilter = signal<string>('All');
  customStartDate = signal<string>('');
  customEndDate = signal<string>('');

  // Pagination
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);

  // Pagination Computations
  totalPages = computed(() => {
    const pages = Math.ceil(this.filteredSessions().length / this.pageSize());
    return pages > 0 ? pages : 1;
  });

  paginatedSessions = computed(() => {
    const list = this.filteredSessions();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  startIndex = computed(() => {
    const len = this.filteredSessions().length;
    if (len === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  endIndex = computed(() => {
    return Math.min(this.currentPage() * this.pageSize(), this.filteredSessions().length);
  });

  totalItems = computed(() => this.filteredSessions().length);

  onSearch(val: string) {
    this.searchQuery.set(val);
    this.currentPage.set(1);
  }

  onStatusChange(status: string) {
    this.selectedStatus.set(status);
    this.currentPage.set(1);
  }

  onTypeChange(type: string) {
    this.selectedType.set(type);
    this.currentPage.set(1);
  }

  onDateFilterChange(filter: string) {
    this.selectedDateFilter.set(filter);
    this.currentPage.set(1);
  }

  onCustomStartDate(date: string) {
    this.customStartDate.set(date);
    this.currentPage.set(1);
  }

  onCustomEndDate(date: string) {
    this.customEndDate.set(date);
    this.currentPage.set(1);
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }

  setPageSize(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  getPageNumbers(): (number | string)[] {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [1];
    if (current > 3) {
      pages.push('...');
    }
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (current < total - 2) {
      pages.push('...');
    }
    pages.push(total);
    return pages;
  }

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

  // Date-filtered sessions for KPIs and table
  dateFilteredSessions = computed(() => {
    let list = this.sessions();
    const dateFilter = this.selectedDateFilter();

    if (dateFilter !== 'All') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const endOfToday = startOfToday + 86400000 - 1;

      if (dateFilter === 'today') {
        list = list.filter(s => s.rawTimestamp >= startOfToday && s.rawTimestamp <= endOfToday);
      } else if (dateFilter === 'yesterday') {
        const startOfYesterday = startOfToday - 86400000;
        list = list.filter(s => s.rawTimestamp >= startOfYesterday && s.rawTimestamp < startOfToday);
      } else if (dateFilter === 'week') {
        const weekAgo = now.getTime() - 7 * 86400000;
        list = list.filter(s => s.rawTimestamp >= weekAgo);
      } else if (dateFilter === 'month') {
        const monthAgo = now.getTime() - 30 * 86400000;
        list = list.filter(s => s.rawTimestamp >= monthAgo);
      } else if (dateFilter === 'custom') {
        const start = this.customStartDate() ? new Date(this.customStartDate()).setHours(0, 0, 0, 0) : 0;
        const end = this.customEndDate() ? new Date(this.customEndDate()).setHours(23, 59, 59, 999) : Infinity;
        list = list.filter(s => s.rawTimestamp >= start && s.rawTimestamp <= end);
      }
    }

    return list;
  });

  // Computed KPIs dynamically based on dateFilteredSessions()
  totalSessionsCount = computed(() => this.dateFilteredSessions().length);

  activeSessionsCount = computed(() =>
    this.dateFilteredSessions().filter(s => s.status === 'active').length
  );

  completedSessionsCount = computed(() =>
    this.dateFilteredSessions().filter(s => s.status === 'completed').length
  );

  totalSessionValue = computed(() =>
    this.dateFilteredSessions().reduce((sum, s) => sum + (s.sessionValue || 0), 0)
  );

  filteredSessions = computed(() => {
    let list = this.dateFilteredSessions();
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
