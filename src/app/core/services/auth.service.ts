import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { User, UserRole } from '../models/user.model';

// Simple SHA-256 based M-PIN hashing (in production use Firebase Functions with bcrypt)
async function hashMpin(mpin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(mpin + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const MPIN_SALT = 'WALKIN_PHYSIO_2026_SALT';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Angular Signals State
  private _currentUser = signal<User | null>(null);
  private _isLoading = signal<boolean>(false);
  private _authError = signal<string | null>(null);

  // Public readonly signals
  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly authError = this._authError.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);
  readonly userRole = computed(() => this._currentUser()?.role ?? null);
  readonly userName = computed(() => this._currentUser()?.name ?? '');

  constructor(private router: Router) {
    this.loadFromSession();
  }

  /** Hash M-PIN before storing or comparing */
  async hashMpin(mpin: string): Promise<string> {
    return hashMpin(mpin, MPIN_SALT);
  }

  /** Validate M-PIN format (4 or 6 digits) */
  validateMpinFormat(mpin: string): boolean {
    return /^\d{4}$|^\d{6}$/.test(mpin);
  }

  /** Set authenticated user and navigate by role */
  setCurrentUser(user: User): void {
    this._currentUser.set(user);
    sessionStorage.setItem('walkin_user', JSON.stringify(user));
    this.navigateByRole(user.role);
  }

  /** Navigate based on user role */
  navigateByRole(role: UserRole): void {
    const routes: Record<UserRole, string> = {
      worker: '/worker/dashboard',
      patient: '/patient/home',
      admin: '/admin/dashboard'
    };
    this.router.navigate([routes[role]]);
  }

  /** Logout and clear state */
  logout(): void {
    this._currentUser.set(null);
    sessionStorage.removeItem('walkin_user');
    this.router.navigate(['/login']);
  }

  setLoading(loading: boolean): void {
    this._isLoading.set(loading);
  }

  setError(error: string | null): void {
    this._authError.set(error);
  }

  clearError(): void {
    this._authError.set(null);
  }

  private loadFromSession(): void {
    try {
      const stored = sessionStorage.getItem('walkin_user');
      if (stored) {
        const user: User = JSON.parse(stored);
        this._currentUser.set(user);
      }
    } catch {
      sessionStorage.removeItem('walkin_user');
    }
  }
}
