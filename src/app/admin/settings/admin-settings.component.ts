import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-admin-page animate-fade-in">
      <!-- Top Bar -->
      <header class="page-top-bar">
        <div>
          <h1 class="page-title">Clinic Settings & Configuration</h1>
          <p class="page-sub">Configure clinic details, session pricing, payment gateway options, and notifications</p>
        </div>
        <button class="btn btn-primary" (click)="saveSettings()" id="save-settings-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          <span>Save Changes</span>
        </button>
      </header>

      @if (saveSuccess()) {
        <div class="alert-success animate-fade-in">
          <span>✓ Settings saved successfully!</span>
        </div>
      }

      <div class="settings-grid">
        <!-- Clinic Profile -->
        <div class="settings-card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Clinic Profile</h3>
              <p class="card-sub">General clinic contact information</p>
            </div>
            <div class="card-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0B2545" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </div>
          </div>

          <div class="form-body">
            <div class="form-group">
              <label class="form-label">Clinic Name</label>
              <input type="text" [(ngModel)]="clinicName" class="setting-input" />
            </div>

            <div class="form-group">
              <label class="form-label">Support Mobile</label>
              <input type="tel" [(ngModel)]="clinicPhone" class="setting-input" />
            </div>

            <div class="form-group">
              <label class="form-label">Clinic Address</label>
              <input type="text" [(ngModel)]="clinicAddress" class="setting-input" />
            </div>

            <div class="form-group">
              <label class="form-label">Operating Hours</label>
              <input type="text" [(ngModel)]="operatingHours" class="setting-input" />
            </div>
          </div>
        </div>

        <!-- Pricing & Clinical Sessions -->
        <div class="settings-card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Session Pricing</h3>
              <p class="card-sub">Standard walk-in rates & duration</p>
            </div>
            <div class="card-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0B2545" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
          </div>

          <div class="form-body">
            <div class="form-group">
              <label class="form-label">Default Walk-In Fee (₹)</label>
              <div class="input-prefix-box">
                <span class="prefix">₹</span>
                <input type="number" [(ngModel)]="walkInFee" class="setting-input clean-input" />
              </div>
              <span class="form-hint">Standard single physiotherapy session cost</span>
            </div>

            <div class="form-group">
              <label class="form-label">Standard Session Duration</label>
              <select [(ngModel)]="sessionDuration" class="setting-input">
                <option value="30">30 Minutes</option>
                <option value="45">45 Minutes (Recommended)</option>
                <option value="60">60 Minutes</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Worker Session Share Formula</label>
              <div class="info-pill-box">
                <span>Monthly Plan: <strong>₹333 / session</strong> (₹10,000 / 30)</span>
                <span>15 Days Plan: <strong>₹400 / session</strong> (₹6,000 / 15)</span>
                <span>Weekly Plan: <strong>₹429 / session</strong> (₹3,000 / 7)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Payment Channels -->
        <div class="settings-card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Payment Gateways</h3>
              <p class="card-sub">Enable or disable payment acceptance channels</p>
            </div>
            <div class="card-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0B2545" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
              </svg>
            </div>
          </div>

          <div class="toggle-list">
            <label class="toggle-row">
              <div class="toggle-info">
                <strong>Razorpay / UPI Gateway</strong>
                <span>Allow patients to pay via Google Pay, PhonePe, and UPI QR</span>
              </div>
              <input type="checkbox" [(ngModel)]="upiEnabled" class="toggle-switch" />
            </label>

            <label class="toggle-row">
              <div class="toggle-info">
                <strong>Credit / Debit Cards</strong>
                <span>Accept Visa, Mastercard, and Rupay cards</span>
              </div>
              <input type="checkbox" [(ngModel)]="cardsEnabled" class="toggle-switch" />
            </label>

            <label class="toggle-row">
              <div class="toggle-info">
                <strong>Clinic Cash Counter</strong>
                <span>Allow staff to collect and settle cash in person</span>
              </div>
              <input type="checkbox" [(ngModel)]="cashEnabled" class="toggle-switch" />
            </label>
          </div>
        </div>

        <!-- Notifications & Alerts -->
        <div class="settings-card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Alerts & Messaging</h3>
              <p class="card-sub">Patient communication channel toggles</p>
            </div>
            <div class="card-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0B2545" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </div>
          </div>

          <div class="toggle-list">
            <label class="toggle-row">
              <div class="toggle-info">
                <strong>SMS OTP Verification</strong>
                <span>Send secure OTP to patients before starting clinical sessions</span>
              </div>
              <input type="checkbox" [(ngModel)]="otpSmsEnabled" class="toggle-switch" />
            </label>

            <label class="toggle-row">
              <div class="toggle-info">
                <strong>WhatsApp Receipts</strong>
                <span>Send automated digital invoice on patient's WhatsApp</span>
              </div>
              <input type="checkbox" [(ngModel)]="whatsappEnabled" class="toggle-switch" />
            </label>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .settings-admin-page { padding: 0; }
    .page-top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
    .page-title { font-size: 24px; font-weight: 800; color: #0F172A; margin: 0 0 4px; letter-spacing: -0.02em; }
    .page-sub { font-size: 13.5px; color: #64748B; margin: 0; }
    .btn { padding: 10px 20px; border-radius: 12px; font-weight: 700; font-size: 13.5px; cursor: pointer; border: none; display: inline-flex; align-items: center; gap: 8px; }
    .btn-primary { background: #0B2545; color: white; transition: all 0.2s; box-shadow: 0 4px 14px rgba(11, 37, 69, 0.2); }
    .btn-primary:hover { background: #1565C0; transform: translateY(-1px); }

    .alert-success { background: #DCFCE7; color: #166534; padding: 12px 18px; border-radius: 12px; font-size: 13.5px; font-weight: 700; margin-bottom: 20px; border: 1px solid #BBF7D0; }

    .settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px; }
    .settings-card { background: #FFFFFF; border-radius: 20px; padding: 24px; box-shadow: 0 3px 16px rgba(15, 23, 42, 0.04); border: 1px solid rgba(226, 232, 240, 0.85); display: flex; flex-direction: column; gap: 18px; }
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .card-title { font-size: 16px; font-weight: 800; color: #0F172A; margin: 0 0 3px; }
    .card-sub { font-size: 12.5px; color: #64748B; margin: 0; }
    .card-icon-wrap { width: 44px; height: 44px; border-radius: 12px; background: #F1F5F9; display: flex; align-items: center; justify-content: center; }

    .form-body { display: flex; flex-direction: column; gap: 14px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-label { font-size: 12px; font-weight: 700; color: #0B2545; }
    .setting-input { width: 100%; height: 42px; padding: 0 14px; border: 1.5px solid #E2E8F0; border-radius: 10px; background: #F8FAFC; font-size: 13.5px; color: #0F172A; outline: none; }
    .setting-input:focus { background: #FFFFFF; border-color: #0284C7; }
    .form-hint { font-size: 11px; color: #64748B; }

    .input-prefix-box { display: flex; align-items: center; background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 10px; padding: 0 12px; }
    .prefix { font-weight: 800; font-size: 14px; color: #0B2545; margin-right: 8px; }
    .clean-input { border: none !important; padding: 0 !important; background: transparent !important; }

    .info-pill-box { display: flex; flex-direction: column; gap: 6px; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 10px; padding: 10px 14px; font-size: 12px; color: #1E40AF; }

    .toggle-list { display: flex; flex-direction: column; gap: 16px; }
    .toggle-row { display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 8px 0; border-bottom: 1px solid #F1F5F9; }
    .toggle-row:last-child { border-bottom: none; }
    .toggle-info { display: flex; flex-direction: column; gap: 2px; max-width: 80%; }
    .toggle-info strong { font-size: 13.5px; color: #0F172A; }
    .toggle-info span { font-size: 12px; color: #64748B; }
    .toggle-switch { width: 22px; height: 22px; accent-color: #0B2545; cursor: pointer; }
  `]
})
export class AdminSettingsComponent {
  clinicName = 'Walk-In Physiotherapy Clinic';
  clinicPhone = '+91 98765 43210';
  clinicAddress = '104, Healthcare Towers, Ring Road, Indore';
  operatingHours = 'Mon - Sat: 08:00 AM - 08:00 PM';

  walkInFee = 500;
  sessionDuration = '45';

  upiEnabled = true;
  cardsEnabled = true;
  cashEnabled = true;

  otpSmsEnabled = true;
  whatsappEnabled = true;

  saveSuccess = signal<boolean>(false);

  saveSettings() {
    this.saveSuccess.set(true);
    setTimeout(() => {
      this.saveSuccess.set(false);
    }, 3000);
  }
}
