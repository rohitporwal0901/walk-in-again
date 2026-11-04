import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PricingService } from '../../core/services/pricing.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { SubscriptionPlan } from '../../core/models/subscription.model';
import { Unsubscribe } from '@angular/fire/firestore';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-page animate-fade-in">
      
      <!-- Top Bar (Compact) -->
      <header class="top-bar">
        <div class="top-titles">
          <div class="live-status-pill">
            <span class="live-dot"></span>
            <span>Firestore Live Sync</span>
          </div>
          <h1 class="page-title">Pricing & Subscription Plans</h1>
          <p class="page-sub">Manage walk-in visit rates and patient subscription packages. All updates sync instantly with the live app.</p>
        </div>

        <button
          type="button"
          class="btn btn-primary"
          (click)="saveAll()"
          [disabled]="isSaving()"
          id="save-all-btn"
        >
          @if (isSaving()) {
            <span class="spinner-sm"></span>
            <span>Saving...</span>
          } @else {
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            <span>Save All Changes</span>
          }
        </button>
      </header>

      <!-- Alert Notification -->
      @if (saveSuccess()) {
        <div class="alert-success animate-fade-in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>{{ saveSuccess() }}</span>
        </div>
      }

      @if (saveError()) {
        <div class="alert-error animate-fade-in">
          <span>{{ saveError() }}</span>
        </div>
      }

      <div class="content-grid">
        
        <!-- ─── 1. Default Walk-In Session Pricing (Compact Card) ─── -->
        <section class="section-card">
          <div class="card-head">
            <div class="ch-left">
              <span class="head-icon icon-blue">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284C7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </span>
              <div>
                <h2 class="head-title">Walk-In Session Pricing</h2>
                <span class="head-sub">Default single visit fee for non-subscribed patients</span>
              </div>
            </div>
            <span class="rate-badge">Current: ₹{{ pricingService.walkInFee() }}</span>
          </div>

          <div class="form-compact">
            <!-- Fee Input & Chips Row -->
            <div class="field-row">
              <label class="field-label" for="walkin-fee-inp">Walk-In Fee (₹)</label>
              <div class="input-chips-group">
                <div class="compact-prefix-box">
                  <span class="p-symbol">₹</span>
                  <input
                    id="walkin-fee-inp"
                    type="number"
                    [ngModel]="walkInFee()"
                    (ngModelChange)="onFeeChange($event)"
                    class="clean-inp fee-inp"
                    min="50"
                    step="50"
                  />
                  <span class="p-unit">/ session</span>
                </div>

                <div class="quick-chips">
                  @for (p of feePresets; track p) {
                    <button
                      type="button"
                      class="chip-btn"
                      [class.chip-active]="walkInFee() === p"
                      (click)="setFee(p)"
                    >
                      ₹{{ p }}
                    </button>
                  }
                </div>
              </div>
            </div>

            <!-- Duration Selector Row -->
            <div class="field-row">
              <label class="field-label">Standard Duration</label>
              <div class="duration-chips">
                @for (d of durationOptions; track d.minutes) {
                  <button
                    type="button"
                    class="dur-chip"
                    [class.dur-active]="sessionDuration() === d.minutes"
                    (click)="setDuration(d.minutes)"
                  >
                    <strong>{{ d.minutes }} Min</strong>
                    <span>{{ d.label }}</span>
                  </button>
                }
              </div>
            </div>

            <!-- Compact Impact Summary -->
            <div class="compact-impact-bar">
              <div class="ci-item">
                <span class="ci-lbl">Patient Checkout</span>
                <span class="ci-val">₹{{ walkInFee() }}</span>
              </div>
              <div class="ci-divider"></div>
              <div class="ci-item">
                <span class="ci-lbl">Worker Earning</span>
                <span class="ci-val text-green">₹{{ walkInFee() }}</span>
              </div>
              <div class="ci-divider"></div>
              <div class="ci-item">
                <span class="ci-lbl">Rate / Minute</span>
                <span class="ci-val">₹{{ ratePerMinute() }}/m</span>
              </div>
            </div>
          </div>
        </section>

        <!-- ─── 2. Subscription Plans Manager (Compact Editable Cards) ─── -->
        <section class="section-card">
          <div class="card-head">
            <div class="ch-left">
              <span class="head-icon icon-teal">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0D9488" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
              </span>
              <div>
                <h2 class="head-title">Subscription Packages</h2>
                <span class="head-sub">Multi-session recovery plans available on patient mobile app</span>
              </div>
            </div>
            <span class="plan-count-badge">{{ editablePlans().length }} Active Packages</span>
          </div>

          <div class="plans-list">
            @for (plan of editablePlans(); track plan.id; let idx = $index) {
              <div class="plan-row-card" [class.plan-popular]="plan.isPopular">
                
                <!-- Plan Header Line -->
                <div class="prc-top">
                  <div class="prc-info">
                    <span class="prc-icon">{{ plan.icon || '📦' }}</span>
                    <input
                      type="text"
                      [(ngModel)]="plan.name"
                      class="clean-inp plan-name-inp"
                      placeholder="Plan Name"
                    />
                  </div>

                  <label class="popular-toggle" title="Highlight this plan as Most Popular for patients">
                    <input
                      type="checkbox"
                      [checked]="plan.isPopular"
                      (change)="togglePlanPopular(idx)"
                    />
                    <span class="pop-pill" [class.pop-active]="plan.isPopular">
                      ★ {{ plan.isPopular ? 'Most Popular' : 'Mark Popular' }}
                    </span>
                  </label>
                </div>

                <!-- Plan Config Inputs (Compact Grid) -->
                <div class="prc-grid">
                  
                  <div class="pg-item">
                    <label class="pg-lbl">Plan Price (₹)</label>
                    <div class="pg-input-box">
                      <span class="pg-sym">₹</span>
                      <input
                        type="number"
                        [(ngModel)]="plan.price"
                        min="100"
                        step="100"
                        class="clean-inp pg-num"
                      />
                    </div>
                  </div>

                  <div class="pg-item">
                    <label class="pg-lbl">Sessions</label>
                    <div class="pg-input-box">
                      <input
                        type="number"
                        [(ngModel)]="plan.sessions"
                        min="1"
                        class="clean-inp pg-num"
                      />
                      <span class="pg-unit">visits</span>
                    </div>
                  </div>

                  <div class="pg-item">
                    <label class="pg-lbl">Validity (Days)</label>
                    <div class="pg-input-box">
                      <input
                        type="number"
                        [(ngModel)]="plan.durationDays"
                        min="1"
                        class="clean-inp pg-num"
                      />
                      <span class="pg-unit">days</span>
                    </div>
                  </div>

                  <div class="pg-item rate-box">
                    <label class="pg-lbl">Effective Rate</label>
                    <div class="pg-rate-display">
                      <span class="rate-val">₹{{ getPerSessionRate(plan) }}</span>
                      <span class="rate-sub">/ session</span>
                    </div>
                  </div>

                </div>

              </div>
            }
          </div>

          <!-- Bottom Action Buttons -->
          <div class="card-footer-compact">
            <button
              type="button"
              class="btn-text"
              (click)="resetAll()"
              [disabled]="isSaving()"
            >
              Reset to Current
            </button>

            <button
              type="button"
              class="btn btn-primary"
              (click)="saveAll()"
              [disabled]="isSaving()"
            >
              @if (isSaving()) {
                <span class="spinner-sm"></span>
                <span>Saving to Firestore...</span>
              } @else {
                <span>Save All Changes</span>
              }
            </button>
          </div>

        </section>

      </div>
    </div>
  `,
  styles: [`
    .settings-page {
      padding: 0;
      max-width: 980px;
      margin: 0 auto;
    }

    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .live-status-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #F0FDF4;
      border: 1px solid #BBF7D0;
      color: #166534;
      font-size: 10.5px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 12px;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .live-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #22C55E;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.4; }
      100% { opacity: 1; }
    }

    .page-title {
      font-size: 20px;
      font-weight: 700;
      color: #0F172A;
      margin: 0 0 2px;
      letter-spacing: -0.01em;
    }

    .page-sub {
      font-size: 12.5px;
      color: #64748B;
      margin: 0;
    }

    .btn {
      padding: 7px 14px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 12.5px;
      cursor: pointer;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.18s;
    }

    .btn-primary {
      background: #0284C7;
      color: white;
      box-shadow: 0 2px 6px rgba(2, 132, 199, 0.25);
    }

    .btn-primary:hover:not(:disabled) {
      background: #0369A1;
      transform: translateY(-1px);
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .spinner-sm {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #FFFFFF;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .alert-success {
      background: #F0FDF4;
      border: 1px solid #86EFAC;
      color: #166534;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .alert-error {
      background: #FEF2F2;
      border: 1px solid #FCA5A5;
      color: #991B1B;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 14px;
    }

    .content-grid {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .section-card {
      background: #FFFFFF;
      border-radius: 12px;
      padding: 16px 18px;
      box-shadow: 0 1px 4px rgba(15, 23, 42, 0.03);
      border: 1px solid #E2E8F0;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding-bottom: 10px;
      border-bottom: 1px solid #F1F5F9;
    }

    .ch-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .head-icon {
      width: 30px;
      height: 30px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .icon-blue {
      background: #E0F2FE;
    }

    .icon-teal {
      background: #CCFBF1;
    }

    .head-title {
      font-size: 14.5px;
      font-weight: 700;
      color: #0F172A;
      margin: 0;
      letter-spacing: -0.01em;
    }

    .head-sub {
      font-size: 12px;
      color: #64748B;
    }

    .rate-badge, .plan-count-badge {
      font-size: 11.5px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 14px;
    }

    .rate-badge {
      background: #EFF6FF;
      color: #1D4ED8;
      border: 1px solid #BFDBFE;
    }

    .plan-count-badge {
      background: #F0FDFA;
      color: #0F766E;
      border: 1px solid #99F6E4;
    }

    .form-compact {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .field-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .field-label {
      font-size: 12px;
      font-weight: 700;
      color: #334155;
    }

    .input-chips-group {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .compact-prefix-box {
      display: flex;
      align-items: center;
      background: #F8FAFC;
      border: 1.5px solid #CBD5E1;
      border-radius: 10px;
      padding: 5px 12px;
      width: 190px;
      transition: all 0.15s;
    }

    .compact-prefix-box:focus-within {
      border-color: #0284C7;
      background: #FFFFFF;
      box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.1);
    }

    .p-symbol {
      font-size: 17px;
      font-weight: 800;
      color: #0F172A;
      margin-right: 4px;
    }

    .clean-inp {
      border: none;
      outline: none;
      background: transparent;
      width: 100%;
      color: #0F172A;
      font-weight: 700;
    }

    .fee-inp {
      font-size: 17px;
    }

    .p-unit {
      font-size: 11px;
      font-weight: 600;
      color: #64748B;
      white-space: nowrap;
    }

    .quick-chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .chip-btn {
      background: #F1F5F9;
      border: 1px solid #E2E8F0;
      color: #475569;
      padding: 5px 10px;
      border-radius: 8px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
    }

    .chip-btn:hover {
      background: #E2E8F0;
      color: #0F172A;
    }

    .chip-btn.chip-active {
      background: #0284C7;
      border-color: #0284C7;
      color: white;
    }

    .duration-chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .dur-chip {
      background: #F8FAFC;
      border: 1.5px solid #E2E8F0;
      border-radius: 9px;
      padding: 6px 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }

    .dur-chip strong {
      font-size: 12px;
      color: #0F172A;
    }

    .dur-chip span {
      font-size: 11px;
      color: #64748B;
    }

    .dur-chip.dur-active {
      background: #EFF6FF;
      border-color: #0284C7;
    }

    .dur-chip.dur-active strong {
      color: #0284C7;
    }

    .compact-impact-bar {
      display: flex;
      align-items: center;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 8px 14px;
      gap: 16px;
      flex-wrap: wrap;
    }

    .ci-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ci-lbl {
      font-size: 11px;
      font-weight: 600;
      color: #64748B;
    }

    .ci-val {
      font-size: 13.5px;
      font-weight: 800;
      color: #0F172A;
    }

    .text-green {
      color: #16A34A;
    }

    .ci-divider {
      width: 1px;
      height: 16px;
      background: #CBD5E1;
    }

    /* Plans List */
    .plans-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .plan-row-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      transition: all 0.15s;
    }

    .plan-row-card:hover {
      border-color: #CBD5E1;
      background: #FFFFFF;
    }

    .plan-popular {
      border-color: #FBBF24;
      background: #FFFDF5;
    }

    .prc-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .prc-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .prc-icon {
      font-size: 16px;
    }

    .plan-name-inp {
      font-size: 14px;
      font-weight: 800;
      color: #0F172A;
      max-width: 160px;
      border-bottom: 1px dashed transparent;
      padding-bottom: 1px;
    }

    .plan-name-inp:focus {
      border-bottom-color: #0284C7;
    }

    .popular-toggle {
      display: flex;
      align-items: center;
      cursor: pointer;
    }

    .popular-toggle input {
      display: none;
    }

    .pop-pill {
      font-size: 10.5px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
      background: #F1F5F9;
      color: #64748B;
      transition: all 0.15s;
    }

    .pop-pill.pop-active {
      background: #FEF3C7;
      color: #B45309;
      border: 1px solid #FDE68A;
    }

    .prc-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 10px;
    }

    .pg-item {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .pg-lbl {
      font-size: 10.5px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .pg-input-box {
      display: flex;
      align-items: center;
      background: #FFFFFF;
      border: 1px solid #CBD5E1;
      border-radius: 8px;
      padding: 4px 8px;
      height: 32px;
      transition: all 0.15s;
    }

    .pg-input-box:focus-within {
      border-color: #0284C7;
      box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.1);
    }

    .pg-sym {
      font-size: 13px;
      font-weight: 800;
      color: #0F172A;
      margin-right: 4px;
    }

    .pg-num {
      font-size: 13px;
      font-weight: 700;
      width: 100%;
    }

    .pg-unit {
      font-size: 10.5px;
      color: #94A3B8;
      font-weight: 600;
      white-space: nowrap;
      margin-left: 4px;
    }

    .rate-box {
      background: #F1F5F9;
      border-radius: 8px;
      padding: 4px 8px;
      justify-content: center;
    }

    .pg-rate-display {
      display: flex;
      align-items: baseline;
      gap: 3px;
    }

    .rate-val {
      font-size: 14px;
      font-weight: 800;
      color: #0369A1;
    }

    .rate-sub {
      font-size: 10.5px;
      color: #64748B;
      font-weight: 600;
    }

    .card-footer-compact {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      padding-top: 10px;
      border-top: 1px solid #F1F5F9;
    }

    .btn-text {
      background: transparent;
      border: none;
      color: #64748B;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 6px;
    }

    .btn-text:hover {
      background: #F1F5F9;
      color: #0F172A;
    }

    @media (max-width: 640px) {
      .top-bar {
        flex-direction: column;
        align-items: flex-start;
      }
      .prc-grid {
        grid-template-columns: 1fr 1fr;
      }
      .btn {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class AdminSettingsComponent implements OnInit, OnDestroy {
  public pricingService = inject(PricingService);
  private subService = inject(SubscriptionService);

  walkInFee = signal<number>(500);
  sessionDuration = signal<number>(45);

  editablePlans = signal<SubscriptionPlan[]>([]);
  private plansUnsub: Unsubscribe | null = null;

  isSaving = signal<boolean>(false);
  saveSuccess = signal<string>('');
  saveError = signal<string>('');

  readonly feePresets = [300, 400, 500, 600, 750];

  readonly durationOptions = [
    { minutes: 30, label: 'Express' },
    { minutes: 45, label: 'Standard' },
    { minutes: 60, label: 'Extended' }
  ];

  readonly ratePerMinute = computed(() => {
    const fee = this.walkInFee();
    const mins = this.sessionDuration();
    if (!mins || mins <= 0) return '0.0';
    return (fee / mins).toFixed(1);
  });

  async ngOnInit() {
    this.walkInFee.set(this.pricingService.walkInFee());
    this.sessionDuration.set(this.pricingService.sessionDuration());

    // Load plans from Firestore config
    const livePlans = await this.subService.getPlans();
    this.editablePlans.set(JSON.parse(JSON.stringify(livePlans)));
  }

  ngOnDestroy() {
    this.plansUnsub?.();
  }

  setFee(val: number) {
    this.walkInFee.set(val);
    this.clearAlerts();
  }

  onFeeChange(val: any) {
    const num = Number(val);
    if (!isNaN(num)) {
      this.walkInFee.set(num);
      this.clearAlerts();
    }
  }

  setDuration(mins: number) {
    this.sessionDuration.set(mins);
    this.clearAlerts();
  }

  togglePlanPopular(idx: number) {
    const list = [...this.editablePlans()];
    list[idx].isPopular = !list[idx].isPopular;
    this.editablePlans.set(list);
    this.clearAlerts();
  }

  getPerSessionRate(plan: SubscriptionPlan): number {
    const sessions = Number(plan.sessions) || 1;
    const price = Number(plan.price) || 0;
    return Math.round(price / sessions);
  }

  async resetAll() {
    this.walkInFee.set(this.pricingService.walkInFee());
    this.sessionDuration.set(this.pricingService.sessionDuration());
    const livePlans = await this.subService.getPlans();
    this.editablePlans.set(JSON.parse(JSON.stringify(livePlans)));
    this.clearAlerts();
  }

  private clearAlerts() {
    this.saveSuccess.set('');
    this.saveError.set('');
  }

  async saveAll() {
    const fee = this.walkInFee();
    const duration = this.sessionDuration();
    const plans = this.editablePlans();

    if (!fee || fee <= 0) {
      this.saveError.set('Please enter a valid walk-in fee (minimum ₹50).');
      return;
    }

    for (const p of plans) {
      if (!p.price || p.price <= 0) {
        this.saveError.set(`Please enter a valid price for ${p.name} plan.`);
        return;
      }
      if (!p.sessions || p.sessions <= 0) {
        this.saveError.set(`Please enter a valid session count for ${p.name} plan.`);
        return;
      }
    }

    this.isSaving.set(true);
    this.clearAlerts();

    try {
      // 1. Update Walk-In Pricing in Firestore (config/pricing)
      await this.pricingService.updatePricing({
        walkInFee: fee,
        sessionDuration: duration,
        notes: `Walk-in rate ₹${fee} for ${duration} mins session`
      });

      // 2. Update Subscription Plans in Firestore (config/subscription_plans)
      const cleanPlans: SubscriptionPlan[] = plans.map(p => ({
        ...p,
        price: Number(p.price),
        sessions: Number(p.sessions),
        durationDays: Number(p.durationDays) || Number(p.sessions),
        name: (p.name || '').trim()
      }));
      await this.subService.updatePlans(cleanPlans);

      this.isSaving.set(false);
      this.saveSuccess.set(`✓ Pricing & all ${cleanPlans.length} subscription packages saved to Firestore!`);

      setTimeout(() => {
        this.saveSuccess.set('');
      }, 5000);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      this.isSaving.set(false);
      this.saveError.set(err?.message || 'Failed to save changes to Firestore.');
    }
  }
}
