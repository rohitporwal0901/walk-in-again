import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-patients',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="animate-fade-in">
      <h1 style="font-size:28px;font-weight:800;color:var(--text-primary);margin-bottom:8px">Patients</h1>
      <p style="color:var(--text-secondary)">Patient management coming in Phase 5...</p>
    </div>
  `
})
export class AdminPatientsComponent {}
