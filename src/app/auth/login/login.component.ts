import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';

export type SheetMode = 'closed' | 'login-pin' | 'register' | 'forgot-pin';

export interface PromoSlide {
  title: string;
  desc: string;
  badge: string;
  img: string;
  bg: string;
  border: string;
  badgeColor: string;
  badgeBg: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  // State Signals
  sheetMode = signal<SheetMode>('closed');
  phoneNumber = signal<string>('');
  isCheckingPhone = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  errorMsg = signal<string>('');

  // Auto Slider State (Swiggy / Zepto Style Mini Carousel)
  currentSlide = signal<number>(0);
  private sliderTimer: any = null;

  slides: PromoSlide[] = [
    {
      title: 'Walk-In Care Anytime',
      desc: 'No prior appointment needed for consultation',
      badge: 'Walk-In',
      img: '/assets/images/slider-walkin.jpg',
      bg: '#FFFFFF',
      border: '#E2E8F0',
      badgeColor: '#0284C7',
      badgeBg: '#F0F9FF'
    },
    {
      title: 'Certified Specialists',
      desc: 'Qualified BPT & MPT orthopedic experts',
      badge: 'Specialists',
      img: '/assets/images/slider-specialist.jpg',
      bg: '#FFFFFF',
      border: '#E2E8F0',
      badgeColor: '#0D9488',
      badgeBg: '#F0FDF4'
    },
    {
      title: 'Targeted Pain Relief',
      desc: 'Spine, knee, shoulder & sports recovery',
      badge: 'Pain Relief',
      img: '/assets/images/slider-relief.jpg',
      bg: '#FFFFFF',
      border: '#E2E8F0',
      badgeColor: '#7C3AED',
      badgeBg: '#FAF5FF'
    },
    {
      title: 'Personalised Recovery',
      desc: 'Customized exercise roadmap for fast healing',
      badge: 'Custom Care',
      img: '/assets/images/slider-rehab.jpg',
      bg: '#FFFFFF',
      border: '#E2E8F0',
      badgeColor: '#0891B2',
      badgeBg: '#ECFEFF'
    }
  ];

  // Existing user retrieved from Firestore
  existingUser = signal<User | null>(null);

  // 4-Digit PIN Arrays for all flows
  loginPinDigits = signal<string[]>(['', '', '', '']);
  registerPinDigits = signal<string[]>(['', '', '', '']);
  registerConfirmPinDigits = signal<string[]>(['', '', '', '']);
  forgotPinDigits = signal<string[]>(['', '', '', '']);
  forgotConfirmPinDigits = signal<string[]>(['', '', '', '']);

  // Patient Registration Form (Front se ONLY patient register hoga)
  registerForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    age: ['', [Validators.required, Validators.min(1), Validators.max(120)]],
    gender: ['Male', [Validators.required]],
    condition: ['Knee Pain', [Validators.required]]
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
    this.startSliderTimer();

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

  ngOnDestroy() {
    this.stopSliderTimer();
  }

  setSlide(index: number) {
    this.currentSlide.set(index);
    this.startSliderTimer();
  }

  private startSliderTimer() {
    this.stopSliderTimer();
    this.sliderTimer = setInterval(() => {
      this.currentSlide.update(c => (c + 1) % this.slides.length);
    }, 3300);
  }

  private stopSliderTimer() {
    if (this.sliderTimer) {
      clearInterval(this.sliderTimer);
      this.sliderTimer = null;
    }
  }

  get reg() {
    return this.registerForm.controls;
  }

  // ─── 1. Phone Input & Auto-Check (10 Digits) ────────────────────────────────
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
        setTimeout(() => this.focusId('login-0'), 200);
      } else {
        // Account does NOT exist -> Open Patient Registration Action Sheet
        this.existingUser.set(null);
        this.registerForm.reset({
          name: '',
          age: '',
          gender: 'Male',
          condition: 'Knee Pain'
        });
        this.registerPinDigits.set(['', '', '', '']);
        this.registerConfirmPinDigits.set(['', '', '', '']);
        this.sheetMode.set('register');
      }
    } catch {
      this.isCheckingPhone.set(false);
      this.errorMsg.set('Network error checking phone. Please try again.');
    }
  }

  // ─── 2. Generic 4-Box PIN Input & Backspace Helpers ─────────────────────────
  onBoxInput(event: Event, index: number, type: 'login' | 'reg' | 'reg-conf' | 'forgot' | 'forgot-conf') {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(-1);
    input.value = val;

    const arr = [...this.getPinArray(type)];
    arr[index] = val;
    this.setPinArray(type, arr);
    this.errorMsg.set('');

    // Advance to next box immediately
    if (val && index < 3) {
      this.focusId(`${type}-${index + 1}`);
    }

    // Auto-actions when 4th digit is filled
    if (index === 3 && val) {
      const allFilled = arr.every(d => d !== '');
      if (allFilled) {
        if (type === 'login') {
          setTimeout(() => this.submitLogin(), 150);
        } else if (type === 'reg') {
          this.focusId('reg-conf-0');
        } else if (type === 'forgot') {
          this.focusId('forgot-conf-0');
        }
      }
    }
  }

  onBoxBackspace(event: Event, index: number, type: 'login' | 'reg' | 'reg-conf' | 'forgot' | 'forgot-conf') {
    const arr = [...this.getPinArray(type)];
    if (!arr[index] && index > 0) {
      arr[index - 1] = '';
      this.setPinArray(type, arr);
      this.focusId(`${type}-${index - 1}`);
    } else {
      arr[index] = '';
      this.setPinArray(type, arr);
    }
  }

  private getPinArray(type: string): string[] {
    switch (type) {
      case 'login': return this.loginPinDigits();
      case 'reg': return this.registerPinDigits();
      case 'reg-conf': return this.registerConfirmPinDigits();
      case 'forgot': return this.forgotPinDigits();
      case 'forgot-conf': return this.forgotConfirmPinDigits();
      default: return [];
    }
  }

  private setPinArray(type: string, arr: string[]): void {
    switch (type) {
      case 'login': this.loginPinDigits.set(arr); break;
      case 'reg': this.registerPinDigits.set(arr); break;
      case 'reg-conf': this.registerConfirmPinDigits.set(arr); break;
      case 'forgot': this.forgotPinDigits.set(arr); break;
      case 'forgot-conf': this.forgotConfirmPinDigits.set(arr); break;
    }
  }

  private focusId(id: string): void {
    setTimeout(() => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.select();
      }
    }, 15);
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
    } catch (e: any) {
      this.isLoading.set(false);
      this.errorMsg.set(e.message || 'Login failed. Please check your M-PIN.');
      this.loginPinDigits.set(['', '', '', '']);
      this.focusId('login-0');
    }
  }

  // ─── 4. Submit Patient Registration with 4-Box PIN & Confirm PIN ────────────
  async submitRegister() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const pin = this.registerPinDigits().join('');
    const confirmPin = this.registerConfirmPinDigits().join('');

    if (pin.length !== 4) {
      this.errorMsg.set('Please set a 4-digit security M-PIN.');
      this.focusId('reg-0');
      return;
    }

    if (pin !== confirmPin) {
      this.errorMsg.set('M-PIN and Confirm M-PIN do not match. Please verify.');
      this.registerConfirmPinDigits.set(['', '', '', '']);
      this.focusId('reg-conf-0');
      return;
    }

    const val = this.registerForm.value;
    this.isLoading.set(true);
    this.errorMsg.set('');

    try {
      await this.authService.registerPatient({
        name: val.name,
        phone: this.phoneNumber(),
        pin: pin,
        age: Number(val.age),
        gender: val.gender,
        condition: val.condition
      });
    } catch (e: any) {
      this.isLoading.set(false);
      this.errorMsg.set(e.message || 'Registration failed. Please try again.');
    }
  }

  // ─── 5. Forgot PIN Flow ─────────────────────────────────────────────────────
  openForgotPin() {
    this.errorMsg.set('');
    this.forgotPinDigits.set(['', '', '', '']);
    this.forgotConfirmPinDigits.set(['', '', '', '']);
    this.sheetMode.set('forgot-pin');
    setTimeout(() => this.focusId('forgot-0'), 200);
  }

  async submitResetPin() {
    const newPin = this.forgotPinDigits().join('');
    const confirmPin = this.forgotConfirmPinDigits().join('');

    if (newPin.length !== 4) {
      this.errorMsg.set('Please enter a 4-digit new M-PIN.');
      this.focusId('forgot-0');
      return;
    }

    if (newPin !== confirmPin) {
      this.errorMsg.set('New M-PIN and Confirm M-PIN do not match.');
      this.forgotConfirmPinDigits.set(['', '', '', '']);
      this.focusId('forgot-conf-0');
      return;
    }

    this.isLoading.set(true);
    this.errorMsg.set('');

    try {
      await this.authService.resetPin(this.phoneNumber(), newPin);
    } catch (e: any) {
      this.isLoading.set(false);
      this.errorMsg.set(e.message || 'Unable to reset M-PIN. Please try again.');
    }
  }

  // ─── Action Sheet Controls ──────────────────────────────────────────────────
  closeSheet() {
    this.sheetMode.set('closed');
    this.errorMsg.set('');
    this.loginPinDigits.set(['', '', '', '']);
    this.registerPinDigits.set(['', '', '', '']);
    this.registerConfirmPinDigits.set(['', '', '', '']);
    this.forgotPinDigits.set(['', '', '', '']);
    this.forgotConfirmPinDigits.set(['', '', '', '']);
  }
}
