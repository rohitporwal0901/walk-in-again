import { Routes } from '@angular/router';

export const WORKER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./worker-shell/worker-shell.component').then(m => m.WorkerShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/worker-dashboard.component').then(m => m.WorkerDashboardComponent)
      },
      {
        path: 'search',
        loadComponent: () =>
          import('./patient-search/patient-search.component').then(m => m.PatientSearchComponent)
      },
      {
        path: 'session/:sessionId',
        loadComponent: () =>
          import('./active-session/active-session.component').then(m => m.ActiveSessionComponent)
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./session-history/session-history.component').then(m => m.SessionHistoryComponent)
      }
    ]
  }
];
