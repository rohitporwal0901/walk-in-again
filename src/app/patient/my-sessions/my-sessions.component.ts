import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Session, SessionStatus } from '../../core/models/session.model';
import { SessionService } from '../../core/services/session.service';
import { AuthService } from '../../core/services/auth.service';
import { Unsubscribe } from '@angular/fire/firestore';

type FilterTab = 'All' | 'Completed' | 'Pending';

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

  private sessionsUnsub: Unsubscribe | null = null;

  activeTab = signal<FilterTab>('All');
  tabs: FilterTab[] = ['All', 'Completed', 'Pending'];

  allSessions = signal<Session[]>([]);
  isLoading = signal<boolean>(true);

  filteredSessions = computed(() => {
    const tab = this.activeTab();
    const sessions = this.allSessions();
    if (tab === 'All') return sessions;
    if (tab === 'Completed') return sessions.filter(s => s.status === 'completed');
    return sessions.filter(s => s.status === 'pending' || s.status === 'active');
  });

  ngOnInit() {
    const user = this.auth.currentUser();
    if (user?.uid) {
      this.sessionsUnsub = this.sessionService.listenToPatientSessions(user.uid, (list) => {
        this.allSessions.set(list);
        this.isLoading.set(false);
      });
    } else {
      this.isLoading.set(false);
    }
  }

  ngOnDestroy() {
    if (this.sessionsUnsub) {
      this.sessionsUnsub();
      this.sessionsUnsub = null;
    }
  }

  setTab(tab: FilterTab) {
    this.activeTab.set(tab);
  }
}
