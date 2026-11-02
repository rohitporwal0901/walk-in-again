import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./admin-shell/admin-shell.component').then(m => m.AdminShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
      },
      {
        path: 'patients',
        loadComponent: () =>
          import('./patients/admin-patients.component').then(m => m.AdminPatientsComponent)
      },
      {
        path: 'transactions',
        loadComponent: () =>
          import('./transactions/admin-transactions.component').then(m => m.AdminTransactionsComponent)
      }
    ]
  }
];
