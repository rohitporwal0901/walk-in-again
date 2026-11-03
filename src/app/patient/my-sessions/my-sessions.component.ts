import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { Session } from '../../core/models/session.model';
import { SessionService } from '../../core/services/session.service';
import { AuthService } from '../../core/services/auth.service';
import { Unsubscribe } from '@angular/fire/firestore';

export type FilterTab = 'All' | 'Completed' | 'Active';

@Component({
  selector: 'app-my-sessions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-sessions.component.html',
  styleUrl: './my-sessions.component.scss'
})
export class MySessionsComponent implements OnInit, OnDestroy {
  private sessionService = inject(SessionService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private location = inject(Location);

  private sessionsUnsub: Unsubscribe | null = null;
  private loadTimeout: any = null;

  activeTab = signal<FilterTab>('All');
  tabs: FilterTab[] = ['All', 'Completed', 'Active'];

  allSessions = signal<Session[]>([]);
  isLoading = signal<boolean>(true);

  // Pagination signals
  currentPage = signal<number>(1);
  pageSize = signal<number>(5);

  filteredSessions = computed(() => {
    const tab = this.activeTab();
    const sessions = this.allSessions();
    if (tab === 'All') return sessions;
    if (tab === 'Completed') return sessions.filter(s => s.status === 'completed');
    if (tab === 'Active') return sessions.filter(s => s.status === 'active');
    return sessions;
  });

  totalPages = computed(() => {
    const count = this.filteredSessions().length;
    return Math.max(1, Math.ceil(count / this.pageSize()));
  });

  paginatedSessions = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredSessions().slice(start, start + this.pageSize());
  });

  pageNumbers = computed(() => {
    const total = this.totalPages();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  ngOnInit() {
    const user = this.auth.currentUser();
    if (user?.uid) {
      this.sessionsUnsub = this.sessionService.listenToPatientSessions(user.uid, (list) => {
        // Sort sessions by date descending (most recent first)
        const sorted = [...list].sort((a, b) => {
          const dateA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
          const dateB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
          return dateB - dateA;
        });
        this.allSessions.set(sorted);
        this.isLoading.set(false);
      });

      this.loadTimeout = setTimeout(() => {
        this.isLoading.set(false);
      }, 1200);
    } else {
      this.isLoading.set(false);
    }
  }

  ngOnDestroy() {
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
    }
    if (this.sessionsUnsub) {
      this.sessionsUnsub();
      this.sessionsUnsub = null;
    }
  }

  setTab(tab: FilterTab) {
    this.activeTab.set(tab);
    this.currentPage.set(1); // Reset to page 1 on tab change
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }

  goBack() {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/patient/home']);
    }
  }
}
