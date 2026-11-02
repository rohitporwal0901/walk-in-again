import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { FirestoreService } from '../../core/services/firestore.service';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private firestoreService = inject(FirestoreService);

  // Signals
  readonly isLoading = this.authService.isLoading;
  readonly authError = this.authService.authError;
  mpin = signal<string>('');
  showMpinScreen = signal<boolean>(false);
  mpinDots = computed(() => Array.from({ length: 6 }, (_, i) => i < this.mpin().length));

  // Form
  mobileForm: FormGroup = this.fb.group({
    mobileNumber: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]]
  });

  // Keypad layout
  keypadKeys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  ngOnInit() {
    // If already logged in, redirect
    if (this.authService.isAuthenticated()) {
      this.authService.navigateByRole(this.authService.userRole()!);
    }
    this.authService.clearError();
  }

  get mobile() { return this.mobileForm.get('mobileNumber'); }

  onMobileSubmit() {
    if (this.mobileForm.invalid) {
      this.mobileForm.markAllAsTouched();
      return;
    }
    this.showMpinScreen.set(true);
    this.mpin.set('');
    this.authService.clearError();
  }

  onKeyPress(key: string) {
    if (key === '⌫') {
      this.mpin.update(p => p.slice(0, -1));
      this.authService.clearError();
    } else if (key !== '' && this.mpin().length < 6) {
      this.mpin.update(p => p + key);
      if (this.mpin().length === 6 || this.mpin().length === 4) {
        // Auto-submit when PIN is complete
        this.submitMpin();
      }
    }
  }

  async submitMpin() {
    const pin = this.mpin();
    if (!this.authService.validateMpinFormat(pin)) return;

    this.authService.setLoading(true);
    this.authService.clearError();

    try {
      const mobile = this.mobileForm.value.mobileNumber;
      const hashedPin = await this.authService.hashMpin(pin);

      // Fetch user from Firestore
      this.firestoreService.getDoc<User>('users', mobile).subscribe({
        next: (user) => {
          this.authService.setLoading(false);
          if (!user) {
            this.authService.setError('Account not found. Please register.');
            this.mpin.set('');
            return;
          }
          if (user.mpinHash !== hashedPin) {
            this.authService.setError('Incorrect M-PIN. Please try again.');
            this.mpin.set('');
            return;
          }
          // Success — set user and route
          this.authService.setCurrentUser(user);
        },
        error: () => {
          this.authService.setLoading(false);
          this.authService.setError('Connection error. Please try again.');
          this.mpin.set('');
        }
      });
    } catch {
      this.authService.setLoading(false);
      this.authService.setError('An error occurred. Please try again.');
    }
  }

  goBack() {
    this.showMpinScreen.set(false);
    this.mpin.set('');
    this.authService.clearError();
  }

  navigateToRegister() {
    this.router.navigate(['/register']);
  }
}
