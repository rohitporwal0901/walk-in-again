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
        path: 'subscriptions',
        loadComponent: () =>
          import('./subscriptions/admin-subscriptions.component').then(m => m.AdminSubscriptionsComponent)
      },
      {
        path: 'patients',
        loadComponent: () =>
          import('./patients/admin-patients.component').then(m => m.AdminPatientsComponent)
      },
      {
        path: 'workers',
        loadComponent: () =>
          import('./workers/admin-workers.component').then(m => m.AdminWorkersComponent)
      },
      {
        path: 'sessions',
        loadComponent: () =>
          import('./sessions/admin-sessions.component').then(m => m.AdminSessionsComponent)
      },
      {
        path: 'transactions',
        loadComponent: () =>
          import('./transactions/admin-transactions.component').then(m => m.AdminTransactionsComponent)
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./reports/admin-reports.component').then(m => m.AdminReportsComponent)
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./settings/admin-settings.component').then(m => m.AdminSettingsComponent)
      }
    ]
  }
];
