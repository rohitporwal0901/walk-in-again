import { Routes } from '@angular/router';

export const PATIENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./patient-shell/patient-shell.component').then(m => m.PatientShellComponent),
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        loadComponent: () =>
          import('./home/patient-home.component').then(m => m.PatientHomeComponent)
      },
      {
        path: 'sessions',
        loadComponent: () =>
          import('./my-sessions/my-sessions.component').then(m => m.MySessionsComponent)
      },
      {
        path: 'payments',
        loadComponent: () =>
          import('./payment-history/payment-history.component').then(m => m.PaymentHistoryComponent)
      }
    ]
  }
];
