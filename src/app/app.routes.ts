import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  // Default redirect
  { path: '', redirectTo: '/login', pathMatch: 'full' },

  // Auth
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./auth/register/register.component').then(m => m.RegisterComponent)
  },

  // Worker Shell (lazy-loaded)
  {
    path: 'worker',
    canActivate: [authGuard, roleGuard(['worker'])],
    loadChildren: () =>
      import('./worker/worker.routes').then(m => m.WORKER_ROUTES)
  },

  // Patient Shell (lazy-loaded)
  {
    path: 'patient',
    canActivate: [authGuard, roleGuard(['patient'])],
    loadChildren: () =>
      import('./patient/patient.routes').then(m => m.PATIENT_ROUTES)
  },

  // Admin Shell (lazy-loaded)
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(['admin'])],
    loadChildren: () =>
      import('./admin/admin.routes').then(m => m.ADMIN_ROUTES)
  },

  // Wildcard
  { path: '**', redirectTo: '/login' }
];
