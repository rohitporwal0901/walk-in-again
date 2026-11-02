import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    while (auth.authLoading()) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    const role = auth.userRole();
    if (role && allowedRoles.includes(role)) {
      return true;
    }

    if (role) {
      auth.navigateByRole(role);
    } else {
      router.navigate(['/login']);
    }
    return false;
  };
};
