import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Firestore, collection, query, where, onSnapshot, Unsubscribe } from '@angular/fire/firestore';
import { User, PatientProfile } from '../../core/models/user.model';
import { Session } from '../../core/models/session.model';
import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-patient-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './patient-search.component.html',
  styleUrl: './patient-search.component.scss'
})
export class PatientSearchComponent implements OnInit, OnDestroy {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);
  private sessionService = inject(SessionService);
  private router = inject(Router);

  searchQuery = signal<string>('');
  allPatients = signal<PatientProfile[]>([]);
  activeSessions = signal<Session[]>([]);
  isLoading = signal<boolean>(true);

  // Modal State
  showModal = signal<boolean>(false);
  modalStep = signal<'confirm' | 'otp'>('confirm');
  selectedPatient = signal<PatientProfile | null>(null);
  activeSessionId = signal<string>('');
  isCreating = signal<boolean>(false);
  isVerifying = signal<boolean>(false);
  otpError = signal<string>('');
  otpDigits = signal<string[]>(['', '', '', '']);

  private usersUnsub: Unsubscribe | null = null;
  private activeSessionsUnsub: Unsubscribe | null = null;

  filteredPatients = computed(() => {
    const queryTerm = this.searchQuery().trim().toLowerCase();
    const list = this.allPatients();

    if (!queryTerm) {
      return list;
    }

    return list.filter(p => {
      const matchName = (p.name || '').toLowerCase().includes(queryTerm);
      const matchPhone = (p.mobileNumber || '').includes(queryTerm);
      const matchCond = (p.condition || p.problemArea || '').toLowerCase().includes(queryTerm);
      return matchName || matchPhone || matchCond;
    });
  });

  ngOnInit() {
    // 1. Listen to all registered patients in real-time
    try {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('role', '==', 'patient'));
      this.usersUnsub = onSnapshot(q, snap => {
        const patients: PatientProfile[] = [];
        snap.forEach(docSnap => {
          const u = docSnap.data() as User;
          patients.push({
            ...u,
            userId: u.uid || docSnap.id
          });
        });
        patients.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        this.allPatients.set(patients);
        this.isLoading.set(false);
      }, err => {
        console.error('Error fetching patients:', err);
        this.isLoading.set(false);
      });
    } catch (e) {
      console.error('Failed to setup patients query:', e);
      this.isLoading.set(false);
    }

    // 2. Listen to active / pending sessions across clinic in real-time (prevents duplicate sessions)
    try {
      this.activeSessionsUnsub = this.sessionService.listenToActiveClinicSessions(activeList => {
        this.activeSessions.set(activeList);
      });
    } catch (e) {
      console.warn('Could not listen to active clinic sessions:', e);
    }
  }

  ngOnDestroy() {
    if (this.usersUnsub) {
      this.usersUnsub();
      this.usersUnsub = null;
    }
    if (this.activeSessionsUnsub) {
      this.activeSessionsUnsub();
      this.activeSessionsUnsub = null;
    }
  }

  onSearch(value: string) {
    this.searchQuery.set(value);
  }

  /** Check if a patient already has an ongoing session */
  getActiveSession(patient: PatientProfile): Session | undefined {
    const pid = patient.uid || patient.userId || patient.mobileNumber;
    return this.activeSessions().find(
      s => (s.patientId === pid || s.patientMobile === patient.mobileNumber) &&
        (s.status === 'active' || s.status === 'pending_otp')
    );
  }

  getAvatarColor(name: string): { bg: string; text: string } {
    const palette = [
      { bg: '#FED7AA', text: '#9A3412' },
      { bg: '#E0F2FE', text: '#0369A1' },
      { bg: '#FCE7F3', text: '#BE185D' },
      { bg: '#DCFCE7', text: '#15803D' },
      { bg: '#EDE9FE', text: '#6D28D9' },
      { bg: '#FEF08A', text: '#854D0E' },
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % palette.length;
    return palette[index];
  }

  /** Worker clicks Action button on Patient Row */
  onPatientAction(patient: PatientProfile) {
    const active = this.getActiveSession(patient);

    if (active) {
      if (active.status === 'active') {
        // Patient is already in session -> Resume active session directly
        this.router.navigate(['/worker/session', active.sessionId]);
        return;
      } else if (active.status === 'pending_otp') {
        // Patient session is waiting for OTP -> Open OTP input modal directly
        this.selectedPatient.set(patient);
        this.activeSessionId.set(active.sessionId);
        this.otpDigits.set(['', '', '', '']);
        this.otpError.set('');
        this.modalStep.set('otp');
        this.showModal.set(true);
        setTimeout(() => this.focusId('otp-0'), 200);
        return;
      }
    }

    // Patient has no active session -> Open Confirmation Modal
    this.selectedPatient.set(patient);
    this.otpError.set('');
    this.otpDigits.set(['', '', '', '']);
    this.modalStep.set('confirm');
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.selectedPatient.set(null);
    this.activeSessionId.set('');
    this.otpDigits.set(['', '', '', '']);
    this.otpError.set('');
    this.isCreating.set(false);
    this.isVerifying.set(false);
  }

  /** Worker confirms start in Step 1 */
  async confirmStartSession() {
    const patient = this.selectedPatient();
    if (!patient) return;

    this.isCreating.set(true);
    this.otpError.set('');

    try {
      const worker = this.auth.currentUser();
      const pid = patient.uid || patient.userId || patient.mobileNumber;

      const res = await this.sessionService.createSessionWithOtp({
        patientId: pid,
        patientName: patient.name || 'Walk-In Patient',
        patientMobile: patient.mobileNumber,
        workerId: worker?.uid || '',
        workerName: worker?.name || 'Physiotherapist',
        workerMobile: worker?.mobileNumber || '',
        notes: patient.problemArea ? `Problem Area: ${patient.problemArea}` : (patient.condition || '')
      });

      this.activeSessionId.set(res.sessionId);
      this.isCreating.set(false);
      this.modalStep.set('otp');
      this.otpDigits.set(['', '', '', '']);
      setTimeout(() => this.focusId('otp-0'), 200);
    } catch (err: any) {
      this.isCreating.set(false);
      this.otpError.set(err?.message || 'Could not start session. Please try again.');
    }
  }

  // ─── 4-Box OTP Input Controls ───────────────────────────────────────────────
  onOtpInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(-1);
    input.value = val;

    const arr = [...this.otpDigits()];
    arr[index] = val;
    this.otpDigits.set(arr);
    this.otpError.set('');

    if (val && index < 3) {
      this.focusId(`otp-${index + 1}`);
    }

    if (index === 3 && val) {
      const allFilled = arr.every(d => d !== '');
      if (allFilled) {
        setTimeout(() => this.submitVerifyOtp(), 150);
      }
    }
  }

  onOtpBackspace(event: Event, index: number) {
    const arr = [...this.otpDigits()];
    if (!arr[index] && index > 0) {
      arr[index - 1] = '';
      this.otpDigits.set(arr);
      this.focusId(`otp-${index - 1}`);
    } else {
      arr[index] = '';
      this.otpDigits.set(arr);
    }
  }

  private focusId(id: string) {
    setTimeout(() => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.select();
      }
    }, 20);
  }

  /** Worker submits OTP entered from Patient */
  async submitVerifyOtp() {
    const code = this.otpDigits().join('');
    if (code.length !== 4) {
      this.otpError.set('Please enter complete 4-digit OTP.');
      return;
    }

    this.isVerifying.set(true);
    this.otpError.set('');

    try {
      const res = await this.sessionService.verifyAndStartSession(this.activeSessionId(), code);
      this.isVerifying.set(false);

      if (res.success) {
        const sessId = this.activeSessionId();
        this.closeModal();
        this.router.navigate(['/worker/session', sessId]);
      } else {
        this.otpError.set(res.message || 'Incorrect OTP. Please check with patient.');
        this.otpDigits.set(['', '', '', '']);
        this.focusId('otp-0');
      }
    } catch (e: any) {
      this.isVerifying.set(false);
      this.otpError.set('Verification failed. Please try again.');
    }
  }

  goBack() {
    this.router.navigate(['/worker/dashboard']);
  }
}
