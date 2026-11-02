import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { FirestoreService } from '../../core/services/firestore.service';
import { User, PatientProfile } from '../../core/models/user.model';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private firestoreService = inject(FirestoreService);

  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  conditions = [
    'Knee Pain',
    'Back & Spine Pain',
    'Neck & Shoulder Pain',
    'Post-Surgery Rehabilitation',
    'Stroke / Neurological Care',
    'Sports Injury',
    'General Mobility & Wellness'
  ];

  registerForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    mobileNumber: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    age: ['', [Validators.required, Validators.min(1), Validators.max(120)]],
    gender: ['Male', [Validators.required]],
    condition: ['Knee Pain', [Validators.required]],
    mpin: ['', [Validators.required, Validators.pattern(/^\d{4}$|^\d{6}$/)]],
    confirmMpin: ['', [Validators.required]]
  });

  get f() { return this.registerForm.controls; }

  async onSubmit() {
    this.errorMessage.set(null);

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const { mpin, confirmMpin, mobileNumber, name, age, gender, condition } = this.registerForm.value;

    if (mpin !== confirmMpin) {
      this.errorMessage.set('M-PIN and Confirm M-PIN do not match.');
      return;
    }

    this.isLoading.set(true);

    try {
      const hashedPin = await this.authService.hashMpin(mpin);

      // Check if user already exists
      this.firestoreService.getDoc<User>('users', mobileNumber).subscribe({
        next: async (existingUser) => {
          if (existingUser) {
            this.isLoading.set(false);
            this.errorMessage.set('An account with this mobile number already exists. Please login.');
            return;
          }

          const newUser: User = {
            mobileNumber,
            mpinHash: hashedPin,
            role: 'patient',
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

          // Save User in 'users' collection
          await this.firestoreService.setDoc('users', mobileNumber, newUser);

          // Save Patient in 'patients' collection
          await this.firestoreService.setDoc('patients', mobileNumber, patientProfile);

          this.isLoading.set(false);

          // Automatically authenticate and navigate to patient home
          this.authService.setCurrentUser(newUser);
        },
        error: async (err) => {
          console.warn('Firestore lookup warning, proceeding with local fallback:', err);
          // Fallback if Firestore rules or offline
          const newUser: User = {
            mobileNumber,
            mpinHash: hashedPin,
            role: 'patient',
            name,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          this.isLoading.set(false);
          this.authService.setCurrentUser(newUser);
        }
      });
    } catch (e: any) {
      this.isLoading.set(false);
      this.errorMessage.set(e?.message || 'Failed to create account. Please try again.');
    }
  }
}
