import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const role = auth.userRole();
    if (role && allowedRoles.includes(role)) {
      return true;
    }
    // Redirect to appropriate home based on actual role
    if (role) {
      auth.navigateByRole(role);
    } else {
      router.navigate(['/login']);
    }
    return false;
  };
};
