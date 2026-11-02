import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="animate-fade-in" style="padding: 4px;">
      <h1 style="font-size: 24px; font-weight: 800; color: #0B2545; margin: 0 0 4px;">Clinic Settings</h1>
      <p style="font-size: 13px; color: #64748B; margin: 0 0 24px;">Configure clinic timings, pricing, and integrations</p>

      <div style="background: white; border-radius: 16px; padding: 40px 20px; text-align: center; border: 1px dashed #CBD5E1;">
        <span style="font-size: 40px; display: block; margin-bottom: 8px;">⚙️</span>
        <h3 style="font-size: 18px; font-weight: 700; color: #0B2545; margin: 0 0 6px;">Settings Center</h3>
        <p style="font-size: 13px; color: #64748B; margin: 0;">Clinic pricing, WhatsApp gateway, and SMS notification settings.</p>
      </div>
    </div>
  `
})
export class AdminSettingsComponent {}
