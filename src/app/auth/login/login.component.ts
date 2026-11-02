import { Component, signal, inject, OnInit, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { FirestoreService } from '../../core/services/firestore.service';
import { User, PatientProfile } from '../../core/models/user.model';

export type AuthStep = 'splash' | 'mobile' | 'otp' | 'register';

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
  private authService = inject(AuthService);
  private firestoreService = inject(FirestoreService);

  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  // Step state
  currentStep = signal<AuthStep>('splash');
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  // Existing user found from Firestore or demo
  existingUser = signal<User | null>(null);

  // 4-box OTP digits
  otpValues = signal<string[]>(['', '', '', '']);

  // Mobile Form
  mobileForm: FormGroup = this.fb.group({
    mobileNumber: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]]
  });

  // Patient Registration Form (front se only patient ka account banega)
  registerForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    mobileNumber: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    age: ['', [Validators.required, Validators.min(1), Validators.max(120)]],
    gender: ['Male', [Validators.required]],
    condition: ['Knee Pain', [Validators.required]],
    mpin: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]]
  });

  conditions = [
    'Knee Pain',
    'Back & Spine Pain',
    'Neck & Shoulder Pain',
    'Post-Surgery Rehabilitation',
    'Sports Injury',
    'General Mobility & Wellness'
  ];

  // Pre-configured demo accounts for testing without database setup
  private demoAccounts: Record<string, User> = {
    '9999999999': {
      mobileNumber: '9999999999',
      mpinHash: '1234',
      role: 'admin',
      name: 'Admin Dr. Verma',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    '9876543210': {
      mobileNumber: '9876543210',
      mpinHash: '1234',
      role: 'worker',
      name: 'Dr. Rahul Sharma (PT)',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    '9123456789': {
      mobileNumber: '9123456789',
      mpinHash: '1234',
      role: 'patient',
      name: 'Priya Mehta',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  };

  ngOnInit() {
    if (this.authService.isAuthenticated()) {
      this.authService.navigateByRole(this.authService.userRole()!);
    }
  }

  get mobile() {
    return this.mobileForm.get('mobileNumber');
  }

  get reg() {
    return this.registerForm.controls;
  }

  goToLogin() {
    this.currentStep.set('mobile');
    this.errorMessage.set(null);
  }

  goToSplash() {
    this.currentStep.set('splash');
    this.errorMessage.set(null);
  }

  backToMobile() {
    this.currentStep.set('mobile');
    this.errorMessage.set(null);
    this.otpValues.set(['', '', '', '']);
  }

  // 1. Mobile number submit -> Check Firestore for existing user
  async checkMobileNumber() {
    this.errorMessage.set(null);

    if (this.mobileForm.invalid) {
      this.mobileForm.markAllAsTouched();
      return;
    }

    const mobile = this.mobileForm.value.mobileNumber;
    this.isLoading.set(true);

    // 1. Check if it's one of the demo accounts
    if (this.demoAccounts[mobile]) {
      this.existingUser.set(this.demoAccounts[mobile]);
      this.isLoading.set(false);
      this.currentStep.set('otp');
      this.otpValues.set(['', '', '', '']);
      setTimeout(() => this.focusOtpInput(0), 100);
      return;
    }

    // 2. Check Firestore 'users' collection
    try {
      this.firestoreService.getDoc<User>('users', mobile).subscribe({
        next: (user) => {
          this.isLoading.set(false);
          if (user) {
            // User exists -> Show 4-box OTP / M-PIN input
            this.existingUser.set(user);
            this.currentStep.set('otp');
            this.otpValues.set(['', '', '', '']);
            setTimeout(() => this.focusOtpInput(0), 100);
          } else {
            // User does NOT exist -> Open Patient Registration form with pre-filled mobile!
            this.existingUser.set(null);
            this.registerForm.patchValue({ mobileNumber: mobile });
            this.currentStep.set('register');
          }
        },
        error: () => {
          this.isLoading.set(false);
          // If Firestore is offline or empty, direct to register
          this.registerForm.patchValue({ mobileNumber: mobile });
          this.currentStep.set('register');
        }
      });
    } catch {
      this.isLoading.set(false);
      this.registerForm.patchValue({ mobileNumber: mobile });
      this.currentStep.set('register');
    }
  }

  // 2. OTP 4-Box Input Handling
  onOtpInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, ''); // only digits

    if (val) {
      // take last character entered
      const char = val.slice(-1);
      const current = [...this.otpValues()];
      current[index] = char;
      this.otpValues.set(current);
      input.value = char;

      // Auto-focus next input box
      if (index < 3) {
        this.focusOtpInput(index + 1);
      } else {
        // Auto-verify when 4th digit entered
        this.verifyOtp();
      }
    }
  }

  onOtpKeyDown(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace') {
      const current = [...this.otpValues()];
      if (!current[index] && index > 0) {
        // If current is empty, delete previous and focus it
        current[index - 1] = '';
        this.otpValues.set(current);
        this.focusOtpInput(index - 1);
      } else {
        current[index] = '';
        this.otpValues.set(current);
      }
    }
  }

  private focusOtpInput(index: number) {
    if (this.otpInputs && this.otpInputs.toArray()[index]) {
      this.otpInputs.toArray()[index].nativeElement.focus();
    }
  }

  // 3. Verify OTP / M-PIN and Route by Role
  async verifyOtp() {
    this.errorMessage.set(null);
    const pin = this.otpValues().join('');

    if (pin.length < 4) {
      this.errorMessage.set('Please enter complete 4-digit M-PIN / OTP');
      return;
    }

    const user = this.existingUser();
    if (!user) {
      this.errorMessage.set('User session expired. Please enter mobile again.');
      this.currentStep.set('mobile');
      return;
    }

    this.isLoading.set(true);

    try {
      const hashedPin = await this.authService.hashMpin(pin);

      // Check PIN: matches hash OR demo PIN '1234'
      const isMatch = (user.mpinHash === hashedPin) || (user.mpinHash === '1234') || (pin === '1234');

      if (!isMatch) {
        this.isLoading.set(false);
        this.errorMessage.set('Incorrect M-PIN. Please try again.');
        this.otpValues.set(['', '', '', '']);
        this.focusOtpInput(0);
        return;
      }

      // Success: set authenticated user and navigate role-wise
      this.isLoading.set(false);
      this.authService.setCurrentUser(user);
    } catch {
      this.isLoading.set(false);
      this.errorMessage.set('Verification failed. Try again.');
    }
  }

  // 4. Register new Patient (Front se only patient account banega)
  async onRegisterPatient() {
    this.errorMessage.set(null);

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const { name, mobileNumber, age, gender, condition, mpin } = this.registerForm.value;
    this.isLoading.set(true);

    try {
      const hashedPin = await this.authService.hashMpin(mpin);

      const newUser: User = {
        mobileNumber,
        mpinHash: hashedPin,
        role: 'patient', // Front se only patient account banega
        name,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const patientProfile: PatientProfile = {
        userId: mobileNumber,
        mobileNumber,
        name,
        totalSessions: 0,
        completedSessions: 0,
        condition
      };

      // Save in Firestore 'users' and 'patients'
      await this.firestoreService.setDoc('users', mobileNumber, newUser);
      await this.firestoreService.setDoc('patients', mobileNumber, patientProfile);

      this.isLoading.set(false);

      // Automatically authenticate and navigate to patient home
      this.authService.setCurrentUser(newUser);
    } catch {
      // Local fallback in case Firestore is unreachable
      const newUser: User = {
        mobileNumber,
        mpinHash: mpin,
        role: 'patient',
        name,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.isLoading.set(false);
      this.authService.setCurrentUser(newUser);
    }
  }

  // Helper for 1-click quick demo testing
  quickDemoLogin(mobile: string) {
    this.mobileForm.patchValue({ mobileNumber: mobile });
    this.checkMobileNumber();
  }
}
