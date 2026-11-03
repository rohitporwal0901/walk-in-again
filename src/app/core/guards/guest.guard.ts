import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guest Guard: Prevents authenticated users from seeing Login / Register pages.
 * If user is already logged in, automatically redirects them straight to their role dashboard
 * without ever flashing the login/signup screen.
 */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);

  // Wait until Firebase Auth initial state resolves
  while (auth.authLoading()) {
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  // If already authenticated, redirect to role dashboard
  if (auth.isAuthenticated()) {
    const role = auth.userRole();
    if (role) {
      auth.navigateByRole(role);
      return false;
    }
  }

  // Not logged in -> allow access to login/register
  return true;
};
