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
          <p class="page-sub">Track clinic receipts, digital UPI payments, cash collections, and plan packages</p>
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
              id="txn-date-filter-select"
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
        <!-- Net Revenue -->
        <div class="kpi-card kpi-card-teal">
          <div class="kpi-top-row">
            <span class="kpi-label">Total Net Revenue</span>
          </div>
          <div class="kpi-bottom-row">
            <span class="kpi-value">₹{{ totalNetRevenue().toLocaleString('en-IN') }}</span>
            <div class="kpi-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 5H7h3a4 4 0 0 1 0 8H7l6 6M7 9h11"></path>
              </svg>
            </div>
          </div>
        </div>

        <!-- Plan Purchases -->
        <div class="kpi-card kpi-card-green">
          <div class="kpi-top-row">
            <span class="kpi-label">Plan Purchases</span>
          </div>
          <div class="kpi-bottom-row">
            <span class="kpi-value">₹{{ subscriptionRevenue().toLocaleString('en-IN') }}</span>
            <div class="kpi-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 3h12l4 6-10 12L2 9z"></path>
              </svg>
            </div>
          </div>
        </div>

        <!-- Walk-In Collections -->
        <div class="kpi-card kpi-card-purple">
          <div class="kpi-top-row">
            <span class="kpi-label">Walk-In Revenue</span>
          </div>
          <div class="kpi-bottom-row">
            <span class="kpi-value">₹{{ walkInRevenue().toLocaleString('en-IN') }}</span>
            <div class="kpi-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <polyline points="17 11 19 13 23 9"></polyline>
              </svg>
            </div>
          </div>
        </div>

        <!-- Total Transactions -->
        <div class="kpi-card kpi-card-blue">
          <div class="kpi-top-row">
            <span class="kpi-label">Total Transactions</span>
          </div>
          <div class="kpi-bottom-row">
            <span class="kpi-value">{{ totalTransactionsCount() }}</span>
            <div class="kpi-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
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
            placeholder="Search transaction ID, patient name, mobile, plan..."
            [value]="searchQuery()"
            (input)="onSearch($any($event.target).value)"
            class="search-input"
            id="txn-search-input"
          />
        </div>

        <!-- Category Filter -->
        <div class="filter-group">
          <span class="filter-lbl">Type:</span>
          @for (c of ['All', 'Subscription', 'Walk-In']; track c) {
            <button
              type="button"
              class="filter-pill"
              [class.active]="selectedCategory() === c"
              (click)="onCategoryChange(c)"
              [id]="'filter-cat-' + c.toLowerCase()"
            >
              {{ c === 'Subscription' ? 'Subscription Plans' : (c === 'Walk-In' ? 'Walk-In Sessions' : 'All Types') }}
            </button>
          }
        </div>

        <!-- Payment Mode Filter -->
        <div class="filter-group">
          <span class="filter-lbl">Mode:</span>
          @for (m of ['All', 'UPI', 'Card', 'Cash']; track m) {
            <button
              type="button"
              class="filter-pill"
              [class.active]="selectedMethod() === m"
              (click)="onMethodChange(m)"
              [id]="'filter-mode-' + m.toLowerCase()"
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
                  <th>Staff / Provider</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (txn of paginatedTransactions(); track txn.id) {
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
                          <span class="p-phone">{{ txn.patientMobile }}</span>
                        </div>
                      </div>
                    </td>

                    <!-- Description -->
                    <td class="col-desc">
                      <div class="desc-cell">
                        <strong class="desc-title">{{ txn.description }}</strong>
                        @if (txn.planName) {
                          <span class="plan-tag">{{ txn.planName }}</span>
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
                        <span class="method-pill method-upi">UPI Online</span>
                      } @else if (txn.paymentMethod === 'Card') {
                        <span class="method-pill method-card">Credit/Debit Card</span>
                      } @else if (txn.paymentMethod === 'Cash') {
                        <span class="method-pill method-cash">Cash Counter</span>
                      } @else if (txn.paymentMethod === 'Subscription') {
                        <span class="method-pill method-sub">Plan Covered</span>
                      } @else {
                        <span class="method-pill method-other">{{ txn.paymentMethod }}</span>
                      }
                    </td>

                    <!-- Worker -->
                    <td class="col-worker">
                      @if (txn.workerName && txn.workerName !== 'Clinic') {
                        <span class="worker-pill">{{ txn.workerName }}</span>
                      } @else {
                        <span class="clinic-pill">Clinic Counter</span>
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
                        <div class="empty-icon-wrap">
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                            <line x1="2" y1="10" x2="22" y2="10"></line>
                          </svg>
                        </div>
                        <h3>No Transactions Found</h3>
                        <p>No financial entries match your selected filters.</p>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination Bar -->
          @if (filteredTransactions().length > 0) {
            <div class="pagination-bar">
              <div class="pagination-info">
                Showing <strong>{{ startIndex() }}</strong>–<strong>{{ endIndex() }}</strong> of <strong>{{ totalItems() }}</strong> transactions
              </div>

              <div class="pagination-actions">
                <!-- Page Size Dropdown -->
                <div class="page-size-selector">
                  <label for="txn-page-size-select">Per page:</label>
                  <select
                    id="txn-page-size-select"
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
    .transactions-admin-page {
      padding: 0;
    }

    .page-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      flex-wrap: wrap;
      gap: 10px;
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
        background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%);
      }
      &.kpi-card-cyan, &.kpi-card-blue {
        background: linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%);
      }
      &.kpi-card-purple {
        background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
      }
      &.kpi-card-green {
        background: linear-gradient(135deg, #059669 0%, #10B981 100%);
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

    // Table Container
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

    .txns-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .txns-table thead tr {
      background: #F8FAFC;
      border-bottom: 1.5px solid #E2E8F0;
    }

    .txns-table th {
      padding: 14px 16px;
      font-size: 11.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748B;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }

    .txns-table tbody tr {
      border-bottom: 1px solid #F1F5F9;
      transition: background 0.15s ease;

      &:hover {
        background: #F8FAFC;
      }
    }

    .txns-table td {
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

    .txn-id {
      font-family: monospace;
      font-size: 12px;
      color: #0284C7;
      font-weight: 700;
    }

    .txn-date {
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

    .desc-cell {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .desc-title {
      font-size: 13px;
      color: #0F172A;
      font-weight: 600;
    }

    .plan-tag {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      color: #6D28D9;
      background: #EDE9FE;
      padding: 3px 8px;
      border-radius: 6px;
      width: fit-content;
      border: 1px solid #DDD6FE;
    }

    .amount-val {
      font-size: 14px;
      font-weight: 800;
      color: #16A34A;
    }

    .method-pill {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 11.5px;
      font-weight: 700;
      white-space: nowrap;
    }

    .method-upi {
      background: #EDE9FE;
      color: #6D28D9;
      border: 1px solid #DDD6FE;
    }

    .method-card {
      background: #E0F2FE;
      color: #0284C7;
      border: 1px solid #BAE6FD;
    }

    .method-cash {
      background: #DCFCE7;
      color: #15803D;
      border: 1px solid #BBF7D0;
    }

    .method-sub {
      background: #FEF3C7;
      color: #92400E;
      border: 1px solid #FDE68A;
    }

    .method-other {
      background: #F1F5F9;
      color: #475569;
    }

    .worker-pill {
      font-size: 12.5px;
      font-weight: 600;
      color: #334155;
    }

    .clinic-pill {
      font-size: 12px;
      font-weight: 600;
      color: #64748B;
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

    .status-paid {
      background: #DCFCE7;
      color: #166534;
      border: 1px solid #BBF7D0;
    }

    .status-paid .dot {
      background: #16A34A;
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

      .txns-table thead tr {
        background: #0F172A !important;
        border-bottom-color: #1E2D48 !important;
      }

      .txns-table th {
        color: #94A3B8 !important;
      }

      .txns-table tbody tr {
        border-bottom-color: #1A2740 !important;
        background: transparent !important;

        &:hover {
          background: #182642 !important;
        }
      }

      .txns-table td {
        color: #CBD5E1 !important;
      }

      .txn-id { color: #38BDF8 !important; }
      .txn-date { color: #94A3B8 !important; }

      .patient-avatar {
        background: rgba(2, 132, 199, 0.2) !important;
        color: #38BDF8 !important;
        border-color: rgba(56, 189, 248, 0.3) !important;
      }

      .p-name { color: #F8FAFC !important; }
      .p-phone { color: #94A3B8 !important; }

      .desc-title { color: #F8FAFC !important; }

      .plan-tag {
        background: rgba(139, 92, 246, 0.18) !important;
        color: #C4B5FD !important;
        border-color: rgba(139, 92, 246, 0.35) !important;
      }

      .amount-val { color: #34D399 !important; }

      .method-pill {
        &.method-upi {
          background: rgba(109, 40, 217, 0.2) !important;
          color: #C4B5FD !important;
          border-color: rgba(139, 92, 246, 0.35) !important;
        }

        &.method-card {
          background: rgba(2, 132, 199, 0.2) !important;
          color: #38BDF8 !important;
          border-color: rgba(56, 189, 248, 0.35) !important;
        }

        &.method-cash {
          background: rgba(22, 163, 74, 0.2) !important;
          color: #4ADE80 !important;
          border-color: rgba(74, 222, 128, 0.35) !important;
        }

        &.method-sub {
          background: rgba(245, 158, 11, 0.2) !important;
          color: #FBBF24 !important;
          border-color: rgba(251, 191, 36, 0.35) !important;
        }

        &.method-other {
          background: #0F172A !important;
          color: #94A3B8 !important;
          border: 1px solid #1E2D48 !important;
        }
      }

      .worker-pill { color: #E2E8F0 !important; }
      .clinic-pill { color: #94A3B8 !important; }

      .status-badge.status-paid {
        background: rgba(16, 185, 129, 0.18) !important;
        color: #34D399 !important;
        border-color: rgba(52, 211, 153, 0.3) !important;
        .dot { background: #34D399 !important; }
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
export class AdminTransactionsComponent implements OnInit, OnDestroy {
  private firestore = inject(Firestore);
  private txnsUnsub: Unsubscribe | null = null;

  transactions = signal<FormattedTransaction[]>([]);
  isLoading = signal<boolean>(true);

  searchQuery = signal<string>('');
  selectedCategory = signal<string>('All'); // 'All', 'Subscription', 'Walk-In'
  selectedMethod = signal<string>('All');   // 'All', 'UPI', 'Card', 'Cash'
  selectedDateFilter = signal<string>('All');
  customStartDate = signal<string>('');
  customEndDate = signal<string>('');

  // Pagination
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);

  // Pagination Computations
  totalPages = computed(() => {
    const pages = Math.ceil(this.filteredTransactions().length / this.pageSize());
    return pages > 0 ? pages : 1;
  });

  paginatedTransactions = computed(() => {
    const list = this.filteredTransactions();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  startIndex = computed(() => {
    const len = this.filteredTransactions().length;
    if (len === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  endIndex = computed(() => {
    return Math.min(this.currentPage() * this.pageSize(), this.filteredTransactions().length);
  });

  totalItems = computed(() => this.filteredTransactions().length);

  onSearch(val: string) {
    this.searchQuery.set(val);
    this.currentPage.set(1);
  }

  onCategoryChange(cat: string) {
    this.selectedCategory.set(cat);
    this.currentPage.set(1);
  }

  onMethodChange(method: string) {
    this.selectedMethod.set(method);
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

        const isSub = t.type === 'subscription' || !!t.planName || t.paymentMethod === 'Subscription';
        const desc = t.description || (isSub ? `Subscription: ${t.planName || 'Plan'}` : 'Physiotherapy Clinical Session');

        items.push({
          id,
          patientName: t.patientName || 'Patient',
          patientMobile: t.patientMobile || 'N/A',
          workerName: t.workerName || 'Clinic',
          amount: Number(t.amount) || 0,
          paymentMethod: t.paymentMethod || 'UPI',
          status: t.status || 'Paid',
          type: isSub ? 'subscription' : (t.type || 'session'),
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

  // Date-filtered base list for KPIs and table
  dateFilteredTransactions = computed(() => {
    let list = this.transactions();
    const dateFilter = this.selectedDateFilter();

    if (dateFilter !== 'All') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const endOfToday = startOfToday + 86400000 - 1;

      if (dateFilter === 'today') {
        list = list.filter(t => t.rawTimestamp >= startOfToday && t.rawTimestamp <= endOfToday);
      } else if (dateFilter === 'yesterday') {
        const startOfYesterday = startOfToday - 86400000;
        list = list.filter(t => t.rawTimestamp >= startOfYesterday && t.rawTimestamp < startOfToday);
      } else if (dateFilter === 'week') {
        const weekAgo = now.getTime() - 7 * 86400000;
        list = list.filter(t => t.rawTimestamp >= weekAgo);
      } else if (dateFilter === 'month') {
        const monthAgo = now.getTime() - 30 * 86400000;
        list = list.filter(t => t.rawTimestamp >= monthAgo);
      } else if (dateFilter === 'custom') {
        const start = this.customStartDate() ? new Date(this.customStartDate()).setHours(0, 0, 0, 0) : 0;
        const end = this.customEndDate() ? new Date(this.customEndDate()).setHours(23, 59, 59, 999) : Infinity;
        list = list.filter(t => t.rawTimestamp >= start && t.rawTimestamp <= end);
      }
    }
    return list;
  });

  // KPIs dynamically update when Date Filter changes!
  totalNetRevenue = computed(() =>
    this.dateFilteredTransactions()
      .filter(t => t.paymentMethod !== 'Subscription')
      .reduce((sum, t) => sum + t.amount, 0)
  );

  subscriptionRevenue = computed(() =>
    this.dateFilteredTransactions()
      .filter(t => (t.type === 'subscription' || !!t.planName) && t.paymentMethod !== 'Subscription')
      .reduce((sum, t) => sum + t.amount, 0)
  );

  subscriptionTxnCount = computed(() =>
    this.dateFilteredTransactions().filter(t => (t.type === 'subscription' || !!t.planName) && t.paymentMethod !== 'Subscription').length
  );

  walkInRevenue = computed(() =>
    this.dateFilteredTransactions()
      .filter(t => t.type !== 'subscription' && !t.planName && t.paymentMethod !== 'Subscription')
      .reduce((sum, t) => sum + t.amount, 0)
  );

  walkInTxnCount = computed(() =>
    this.dateFilteredTransactions().filter(t => t.type !== 'subscription' && !t.planName && t.paymentMethod !== 'Subscription').length
  );

  totalTransactionsCount = computed(() =>
    this.dateFilteredTransactions().filter(t => t.paymentMethod !== 'Subscription').length
  );

  averageTxnValue = computed(() => {
    const cashTxns = this.dateFilteredTransactions().filter(t => t.paymentMethod !== 'Subscription');
    if (!cashTxns.length) return 0;
    return Math.round(this.totalNetRevenue() / cashTxns.length);
  });

  filteredTransactions = computed(() => {
    let list = this.dateFilteredTransactions();
    const query = this.searchQuery().toLowerCase().trim();
    const cat = this.selectedCategory();
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

    // Category Filter: Fixes the subscription filter bug!
    if (cat === 'Subscription') {
      list = list.filter(t => t.type === 'subscription' || !!t.planName || t.paymentMethod === 'Subscription');
    } else if (cat === 'Walk-In') {
      list = list.filter(t => t.type !== 'subscription' && !t.planName && t.paymentMethod !== 'Subscription');
    }

    // Payment Method Filter:
    if (method !== 'All') {
      list = list.filter(t => t.paymentMethod === method);
    }

    return list.filter(t => t.paymentMethod !== 'Subscription');
  });
}
