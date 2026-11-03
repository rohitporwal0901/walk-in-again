import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Firestore, collection, query, where, onSnapshot, Unsubscribe } from '@angular/fire/firestore';
import { User, PatientProfile } from '../../core/models/user.model';
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
  isLoading = signal<boolean>(true);
  isCreatingSession = signal<boolean>(false);
  creatingPatientId = signal<string | null>(null);

  private usersUnsub: Unsubscribe | null = null;

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
    // Listen to all registered patients in real-time
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
        // Sort alphabetically by name
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
  }

  ngOnDestroy() {
    if (this.usersUnsub) {
      this.usersUnsub();
      this.usersUnsub = null;
    }
  }

  onSearch(value: string) {
    this.searchQuery.set(value);
  }

  getAvatarColor(name: string): { bg: string; text: string } {
    const palette = [
      { bg: '#FED7AA', text: '#9A3412' }, // warm amber
      { bg: '#E0F2FE', text: '#0369A1' }, // sky blue
      { bg: '#FCE7F3', text: '#BE185D' }, // rose pink
      { bg: '#DCFCE7', text: '#15803D' }, // emerald green
      { bg: '#EDE9FE', text: '#6D28D9' }, // violet
      { bg: '#FEF08A', text: '#854D0E' }, // sunny yellow
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % palette.length;
    return palette[index];
  }

  async startSessionForPatient(patient: PatientProfile) {
    const pid = patient.uid || patient.userId || patient.mobileNumber;
    if (this.isCreatingSession()) return;

    this.isCreatingSession.set(true);
    this.creatingPatientId.set(pid);

    try {
      const worker = this.auth.currentUser();
      const patientId = pid;

      const sessionId = await this.sessionService.createSession({
        patientId,
        patientName: patient.name || 'Walk-In Patient',
        patientMobile: patient.mobileNumber,
        workerId: worker?.uid || '',
        workerName: worker?.name || 'Physiotherapist',
        workerMobile: worker?.mobileNumber || '',
        notes: patient.problemArea ? `Problem Area: ${patient.problemArea}` : (patient.condition || '')
      });

      this.router.navigate(['/worker/session', sessionId]);
    } catch (e) {
      console.error('Failed to create session for patient:', e);
      alert('Could not start session. Please try again.');
    } finally {
      this.isCreatingSession.set(false);
      this.creatingPatientId.set(null);
    }
  }

  goBack() {
    this.router.navigate(['/worker/dashboard']);
  }
}
