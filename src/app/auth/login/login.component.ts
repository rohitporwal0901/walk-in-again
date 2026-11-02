import { Component, signal, inject, OnInit, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';

export type SheetMode = 'closed' | 'login-pin' | 'register';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  @ViewChildren('pinBox') pinBoxes!: QueryList<ElementRef<HTMLInputElement>>;

  // State Signals
  sheetMode = signal<SheetMode>('closed');
  phoneNumber = signal<string>('');
  isCheckingPhone = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  errorMsg = signal<string>('');

  // Existing user retrieved from Firestore
  existingUser = signal<User | null>(null);

  // 4-Digit M-PIN array
  loginPinDigits = signal<string[]>(['', '', '', '']);

  // Patient Registration Form (Front se ONLY patient register hoga)
  registerForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    age: ['', [Validators.required, Validators.min(1), Validators.max(120)]],
    gender: ['Male', [Validators.required]],
    condition: ['Knee Pain', [Validators.required]],
    pin: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]]
  });

  conditions = [
    'Knee Pain',
    'Back & Spine Pain',
    'Neck & Shoulder Pain',
    'Post-Surgery Rehabilitation',
    'Sports Injury',
    'General Mobility & Wellness'
  ];

  async ngOnInit() {
    // If user is already authenticated in Firebase, automatically navigate by role
    while (this.authService.authLoading()) {
      await new Promise(r => setTimeout(r, 50));
    }

    if (this.authService.isAuthenticated()) {
      const role = this.authService.userRole();
      if (role) {
        this.authService.navigateByRole(role);
      }
    }
  }

  get reg() {
    return this.registerForm.controls;
  }

  // ─── 1. Phone Input & Auto-Proceed (10 Digits) ──────────────────────────────
  onPhoneInput(event: Event) {
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/\D/g, '');
    this.phoneNumber.set(input.value);
    this.errorMsg.set('');

    // Rapido / Khandelwal style: auto check when 10 digits entered
    if (input.value.length === 10) {
      setTimeout(() => this.checkPhone(), 150);
    }
  }

  async checkPhone() {
    const phone = this.phoneNumber();
    if (phone.length !== 10) {
      this.errorMsg.set('Please enter a valid 10-digit mobile number.');
      return;
    }

    this.isCheckingPhone.set(true);
    this.errorMsg.set('');

    try {
      const user = await this.authService.isPhoneRegistered(phone);
      this.isCheckingPhone.set(false);

      if (user) {
        // Account exists -> Open Login Action Sheet (4-Box PIN)
        this.existingUser.set(user);
        this.loginPinDigits.set(['', '', '', '']);
        this.sheetMode.set('login-pin');
        setTimeout(() => this.focusPinBox(0), 200);
      } else {
        // Account does NOT exist -> Open Patient Registration Action Sheet
        this.existingUser.set(null);
        this.registerForm.reset({
          name: '',
          age: '',
          gender: 'Male',
          condition: 'Knee Pain',
          pin: ''
        });
        this.sheetMode.set('register');
      }
    } catch {
      this.isCheckingPhone.set(false);
      this.errorMsg.set('Network error checking phone. Please try again.');
    }
  }

  // ─── 2. 4-Box PIN Input Handling ────────────────────────────────────────────
  onPinInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(-1);
    input.value = val;

    const arr = [...this.loginPinDigits()];
    arr[index] = val;
    this.loginPinDigits.set(arr);
    this.errorMsg.set('');

    if (val && index < 3) {
      this.focusPinBox(index + 1);
    }

    // Auto-submit when all 4 digits are entered
    if (index === 3 && val) {
      const allFilled = arr.every(d => d !== '');
      if (allFilled) {
        setTimeout(() => this.submitLogin(), 150);
      }
    }
  }

  onPinBackspace(event: Event, index: number) {
    const arr = [...this.loginPinDigits()];
    if (!arr[index] && index > 0) {
      arr[index - 1] = '';
      this.loginPinDigits.set(arr);
      this.focusPinBox(index - 1);
    } else {
      arr[index] = '';
      this.loginPinDigits.set(arr);
    }
  }

  private focusPinBox(index: number) {
    if (this.pinBoxes && this.pinBoxes.toArray()[index]) {
      this.pinBoxes.toArray()[index].nativeElement.focus();
    }
  }

  // ─── 3. Submit Login (M-PIN) ────────────────────────────────────────────────
  async submitLogin() {
    const pin = this.loginPinDigits().join('');
    if (pin.length !== 4) {
      this.errorMsg.set('Please enter complete 4-digit M-PIN.');
      return;
    }

    this.isLoading.set(true);
    this.errorMsg.set('');

    try {
      await this.authService.loginWithMpin(this.phoneNumber(), pin);
      // Navigation is handled inside authService.loginWithMpin based on user.role
    } catch (e: any) {
      this.isLoading.set(false);
      this.errorMsg.set(e.message || 'Login failed. Please check your M-PIN.');
      this.loginPinDigits.set(['', '', '', '']);
      this.focusPinBox(0);
    }
  }

  // ─── 4. Submit Patient Registration ─────────────────────────────────────────
  async submitRegister() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const val = this.registerForm.value;
    this.isLoading.set(true);
    this.errorMsg.set('');

    try {
      await this.authService.registerPatient({
        name: val.name,
        phone: this.phoneNumber(),
        pin: val.pin,
        age: Number(val.age),
        gender: val.gender,
        condition: val.condition
      });
      // Automatically navigates to /patient/home on success
    } catch (e: any) {
      this.isLoading.set(false);
      this.errorMsg.set(e.message || 'Registration failed. Please try again.');
    }
  }

  // ─── Action Sheet Controls ──────────────────────────────────────────────────
  closeSheet() {
    this.sheetMode.set('closed');
    this.errorMsg.set('');
    this.loginPinDigits.set(['', '', '', '']);
  }
}
