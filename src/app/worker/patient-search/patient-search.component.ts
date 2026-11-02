import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirestoreService } from '../../core/services/firestore.service';
import { PatientProfile } from '../../core/models/user.model';

@Component({
  selector: 'app-patient-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './patient-search.component.html',
  styleUrl: './patient-search.component.scss'
})
export class PatientSearchComponent {
  private firestoreService = inject(FirestoreService);
  private router = inject(Router);

  searchQuery = signal<string>('');
  searchResults = signal<PatientProfile[]>([]);
  isSearching = signal<boolean>(false);
  hasSearched = signal<boolean>(false);

  // Mock data for demo
  private mockPatients: PatientProfile[] = [
    { userId: 'p1', mobileNumber: '9812345678', name: 'Anita Sharma', condition: 'Knee Pain', totalSessions: 12, completedSessions: 8 },
    { userId: 'p2', mobileNumber: '9912345678', name: 'Pooja Mehta', condition: 'Shoulder Pain', totalSessions: 6, completedSessions: 4 },
    { userId: 'p3', mobileNumber: '9712345678', name: 'Neha Gupta', condition: 'Back Pain', totalSessions: 10, completedSessions: 6 },
    { userId: 'p4', mobileNumber: '9612345678', name: 'Rohit Varma', condition: 'Neck Pain', totalSessions: 8, completedSessions: 3 },
  ];

  onSearch(value: string) {
    this.searchQuery.set(value);
    if (value.trim().length < 2) {
      this.searchResults.set([]);
      this.hasSearched.set(false);
      return;
    }
    this.isSearching.set(true);
    this.hasSearched.set(true);
    // Simulate async search
    setTimeout(() => {
      const q = value.toLowerCase();
      this.searchResults.set(
        this.mockPatients.filter(p =>
          p.name.toLowerCase().includes(q) || p.mobileNumber.includes(q)
        )
      );
      this.isSearching.set(false);
    }, 400);
  }

  startSessionForPatient(patient: PatientProfile) {
    this.router.navigate(['/worker/session', `sess_${patient.userId}`]);
  }
}
