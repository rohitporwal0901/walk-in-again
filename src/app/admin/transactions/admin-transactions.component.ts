import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-transactions',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="animate-fade-in">
      <h1 style="font-size:28px;font-weight:800;color:var(--text-primary);margin-bottom:8px">Transactions</h1>
      <p style="color:var(--text-secondary)">Full transaction table coming in Phase 5...</p>
    </div>
  `
})
export class AdminTransactionsComponent {}
