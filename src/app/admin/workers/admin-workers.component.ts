import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Firestore, collection, query, where, onSnapshot } from '@angular/fire/firestore';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-admin-workers',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="workers-page animate-fade-in">
      <div class="page-top-bar">
        <div>
          <h1 class="page-title">Workers & Physiotherapists</h1>
          <p class="page-sub">Manage clinic physiotherapists and staff members</p>
        </div>
        <button class="btn btn-primary" (click)="openAddWorkerModal()">
          ➕ Register New Worker
        </button>
      </div>

      <!-- Workers Grid -->
      <div class="workers-grid">
        @for (worker of workers(); track worker.uid || worker.mobileNumber) {
          <div class="worker-card animate-fade-in-up">
            <div class="worker-avatar">
              {{ (worker.name || 'W').charAt(0).toUpperCase() }}
            </div>
            <div class="worker-details">
              <h3 class="worker-name">{{ worker.name }}</h3>
              <p class="worker-spec">{{ worker.specialization || 'Physiotherapist' }}</p>
              <div class="worker-chips">
                <span class="chip-item">📱 +91 {{ worker.mobileNumber }}</span>
                <span class="chip-item">⏱ {{ worker.experience || '3 Years' }}</span>
              </div>
            </div>
          </div>
        } @empty {
          <div class="empty-state">
            <div class="empty-icon">👨‍⚕️</div>
            <h3>No Workers Registered Yet</h3>
            <p>Admin can register clinic physiotherapists using the button below.</p>
            <button class="btn btn-primary" (click)="openAddWorkerModal()">
              Register First Worker
            </button>
          </div>
        }
      </div>

      <!-- Add Worker Modal -->
      @if (showAddWorkerModal()) {
        <div class="modal-overlay" (click)="closeAddWorkerModal()">
          <div class="worker-modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <h2 class="modal-title">Register New Worker / Physio</h2>
                <p class="modal-sub">Create worker staff account in Walk In Physio</p>
              </div>
              <button class="btn-close" (click)="closeAddWorkerModal()">✕</button>
            </div>

            @if (workerModalSuccess()) {
              <div class="alert-success animate-fade-in">
                <span>✓ {{ workerModalSuccess() }}</span>
              </div>
            }

            @if (workerModalError()) {
              <div class="alert-error animate-fade-in">
                <span>⚠️ {{ workerModalError() }}</span>
              </div>
            }

            <form [formGroup]="workerForm" (ngSubmit)="submitNewWorker()" class="modal-form">
              <div class="form-group">
                <label class="form-label">Full Name *</label>
                <input type="text" formControlName="name" placeholder="e.g. Dr. Rahul Sharma" class="modal-input" />
              </div>

              <div class="form-group">
                <label class="form-label">Mobile Number *</label>
                <div class="input-with-prefix">
                  <span class="prefix">+91</span>
                  <input type="tel" formControlName="phone" placeholder="10-digit mobile" maxlength="10" class="modal-input" />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group flex-1">
                  <label class="form-label">Specialization *</label>
                  <select formControlName="specialization" class="modal-select">
                    @for (spec of specializations; track spec) {
                      <option [value]="spec">{{ spec }}</option>
                    }
                  </select>
                </div>

                <div class="form-group flex-1">
                  <label class="form-label">Experience *</label>
                  <input type="text" formControlName="experience" placeholder="e.g. 4 Years" class="modal-input" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Assign 4-Digit M-PIN *</label>
                <input type="password" formControlName="pin" placeholder="4-digit PIN (e.g. 1234)" maxlength="4" inputmode="numeric" class="modal-input" />
                <span class="field-hint">Worker will use this PIN to log in on their mobile.</span>
              </div>

              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" (click)="closeAddWorkerModal()">Cancel</button>
                <button type="submit" class="btn btn-primary" [disabled]="isSubmittingWorker() || workerForm.invalid">
                  @if (isSubmittingWorker()) {
                    <span>Creating Account...</span>
                  } @else {
                    <span>Save & Register Worker</span>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .workers-page { padding: 0 4px; }
    .page-top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .page-title { font-size: 24px; font-weight: 800; color: #0B2545; margin: 0 0 4px; }
    .page-sub { font-size: 13px; color: #64748B; margin: 0; }
    .btn { padding: 10px 18px; border-radius: 12px; font-weight: 700; font-size: 13.5px; cursor: pointer; border: none; }
    .btn-primary { background: #0B2545; color: white; transition: all 0.2s; }
    .btn-primary:hover { background: #1565C0; }
    .btn-secondary { background: #F1F5F9; color: #475569; }
    .workers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; }
    .worker-card { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 4px 16px rgba(0,0,0,0.04); border: 1px solid #E2E8F0; display: flex; gap: 16px; align-items: center; }
    .worker-avatar { width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, #0B2545, #1565C0); color: white; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; flex-shrink: 0; }
    .worker-name { font-size: 16px; font-weight: 800; color: #0B2545; margin: 0 0 2px; }
    .worker-spec { font-size: 13px; color: #1565C0; font-weight: 600; margin: 0 0 8px; }
    .worker-chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip-item { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 3px 8px; border-radius: 8px; font-size: 11.5px; color: #475569; }
    .empty-state { grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: white; border-radius: 16px; border: 1px dashed #CBD5E1; }
    .empty-icon { font-size: 48px; margin-bottom: 12px; }
    .empty-state h3 { font-size: 18px; font-weight: 800; color: #0B2545; margin: 0 0 6px; }
    .empty-state p { font-size: 13.5px; color: #64748B; margin: 0 0 18px; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(11, 37, 69, 0.65); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box; }
    .worker-modal { position: relative; width: 100%; max-width: 480px; max-height: calc(100vh - 40px); overflow-y: auto; background: white; border-radius: 20px; padding: 22px 24px; box-shadow: 0 25px 60px rgba(11,37,69,0.4); z-index: 10000; display: flex; flex-direction: column; box-sizing: border-box; }
    .modal-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .modal-title { font-size: 18px; font-weight: 800; color: #0B2545; margin: 0 0 2px; }
    .modal-sub { font-size: 12.5px; color: #64748B; margin: 0; }
    .btn-close { width: 32px; height: 32px; border-radius: 50%; border: none; background: #F1F5F9; cursor: pointer; color: #64748B; font-weight: 700; }
    .alert-success { background: #DCFCE7; color: #166534; padding: 10px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; margin-bottom: 14px; }
    .alert-error { background: #FEE2E2; color: #DC2626; padding: 10px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; margin-bottom: 14px; }
    .modal-form { display: flex; flex-direction: column; gap: 12px; }
    .form-group { display: flex; flex-direction: column; gap: 5px; }
    .form-row { display: flex; gap: 10px; }
    .flex-1 { flex: 1; min-width: 0; }
    .form-label { font-size: 12px; font-weight: 700; color: #0B2545; }
    .modal-input, .modal-select { width: 100%; height: 42px; padding: 0 12px; border: 1.5px solid #E2E8F0; border-radius: 10px; background: #F8FAFC; font-size: 13.5px; outline: none; }
    .modal-input:focus, .modal-select:focus { border-color: #0B2545; background: white; }
    .input-with-prefix { display: flex; align-items: center; background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 10px; padding: 0 10px; }
    .prefix { font-weight: 700; font-size: 13px; color: #0B2545; margin-right: 8px; padding-right: 8px; border-right: 1px solid #CBD5E1; }
    .input-with-prefix .modal-input { border: none; padding: 0; background: transparent; }
    .field-hint { font-size: 11px; color: #64748B; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; }
  `]
})
export class AdminWorkersComponent implements OnInit {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  workers = signal<User[]>([]);
  showAddWorkerModal = signal<boolean>(false);
  isSubmittingWorker = signal<boolean>(false);
  workerModalError = signal<string>('');
  workerModalSuccess = signal<string>('');

  workerForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    specialization: ['Orthopedic Physiotherapy', [Validators.required]],
    experience: ['3 Years', [Validators.required]],
    pin: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]]
  });

  specializations = [
    'Orthopedic Physiotherapy',
    'Sports Rehabilitation',
    'Neurological PT',
    'Cardiopulmonary Rehab',
    'Pediatric Physiotherapy',
    'Geriatric Physiotherapy'
  ];

  ngOnInit() {
    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where('role', '==', 'worker'));
    onSnapshot(q, (snapshot) => {
      const list: User[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as User);
      });
      this.workers.set(list);
    });
  }

  openAddWorkerModal() {
    this.workerModalError.set('');
    this.workerModalSuccess.set('');
    this.workerForm.reset({
      name: '',
      phone: '',
      specialization: 'Orthopedic Physiotherapy',
      experience: '3 Years',
      pin: '1234'
    });
    this.showAddWorkerModal.set(true);
  }

  closeAddWorkerModal() {
    this.showAddWorkerModal.set(false);
  }

  async submitNewWorker() {
    if (this.workerForm.invalid) {
      this.workerForm.markAllAsTouched();
      return;
    }
    const { name, phone, specialization, experience, pin } = this.workerForm.value;
    this.isSubmittingWorker.set(true);
    this.workerModalError.set('');
    this.workerModalSuccess.set('');
    try {
      await this.authService.createWorkerFromAdmin({ name, phone, pin, specialization, experience });
      this.isSubmittingWorker.set(false);
      this.workerModalSuccess.set(`Worker "${name}" successfully registered!`);
      setTimeout(() => this.closeAddWorkerModal(), 1800);
    } catch (e: any) {
      this.isSubmittingWorker.set(false);
      this.workerModalError.set(e.message || 'Failed to create worker account.');
    }
  }
}
