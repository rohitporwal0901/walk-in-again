import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';
import { User, PatientProfile } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-patient-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './patient-search.component.html',
  styleUrl: './patient-search.component.scss'
})
export class PatientSearchComponent {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);
  private sessionService = inject(SessionService);
  private router = inject(Router);

  searchQuery = signal<string>('');
  searchResults = signal<PatientProfile[]>([]);
  isSearching = signal<boolean>(false);
  hasSearched = signal<boolean>(false);
  isCreatingSession = signal<boolean>(false);

  async onSearch(value: string) {
    this.searchQuery.set(value);
    const qTerm = value.trim();

    if (qTerm.length < 2) {
      this.searchResults.set([]);
      this.hasSearched.set(false);
      return;
    }

    this.isSearching.set(true);
    this.hasSearched.set(true);

    try {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('role', '==', 'patient'));
      const snap = await getDocs(q);

      const patients: PatientProfile[] = [];
      const termLower = qTerm.toLowerCase();

      snap.forEach(docSnap => {
        const u = docSnap.data() as User;
        const matchesName = u.name?.toLowerCase().includes(termLower);
        const matchesPhone = u.mobileNumber?.includes(termLower);

        if (matchesName || matchesPhone) {
          patients.push({
            ...u,
            userId: u.uid || docSnap.id
          });
        }
      });

      this.searchResults.set(patients);
    } catch (e) {
      console.error('Error searching patients:', e);
      this.searchResults.set([]);
    } finally {
      this.isSearching.set(false);
    }
  }

  async startSessionForPatient(patient: PatientProfile) {
    if (this.isCreatingSession()) return;
    this.isCreatingSession.set(true);

    try {
      const worker = this.auth.currentUser();
      const patientId = patient.uid || patient.userId || patient.mobileNumber;

      const sessionId = await this.sessionService.createSession({
        patientId,
        patientName: patient.name || 'Walk-In Patient',
        patientMobile: patient.mobileNumber,
        workerId: worker?.uid || '',
        workerName: worker?.name || 'Physiotherapist',
        workerMobile: worker?.mobileNumber || '',
        notes: patient.problemArea ? `Problem Area: ${patient.problemArea}` : ''
      });

      this.router.navigate(['/worker/session', sessionId]);
    } catch (e) {
      console.error('Failed to create session for patient:', e);
      alert('Could not start session. Please try again.');
    } finally {
      this.isCreatingSession.set(false);
    }
  }
}
