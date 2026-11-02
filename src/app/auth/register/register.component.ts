import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

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
    mpin: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
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
      await this.authService.registerPatient({
        name,
        phone: mobileNumber,
        pin: mpin,
        age: Number(age),
        gender,
        condition
      });
      this.isLoading.set(false);
    } catch (e: any) {
      this.isLoading.set(false);
      this.errorMessage.set(e?.message || 'Failed to create account. Please try again.');
    }
  }
}
