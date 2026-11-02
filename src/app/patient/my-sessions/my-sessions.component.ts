import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Session, SessionStatus } from '../../core/models/session.model';

type FilterTab = 'All' | 'Completed' | 'Pending';

@Component({
  selector: 'app-my-sessions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-sessions.component.html',
  styleUrl: './my-sessions.component.scss'
})
export class MySessionsComponent {
  activeTab = signal<FilterTab>('All');
  tabs: FilterTab[] = ['All', 'Completed', 'Pending'];

  allSessions: Session[] = [
    { sessionId: 's1', patientId: 'p1', patientName: 'Priya', workerId: 'w1', workerName: 'Rahul Sharma',
      date: new Date('2026-10-26'), timeSlot: '10:00 AM - 10:30 AM', duration: 30, status: 'completed',
      therapies: [], notes: '', fee: 500, createdAt: new Date(), updatedAt: new Date() },
    { sessionId: 's2', patientId: 'p1', patientName: 'Priya', workerId: 'w1', workerName: 'Neha Gupta',
      date: new Date('2026-10-24'), timeSlot: '11:00 AM - 11:30 AM', duration: 30, status: 'completed',
      therapies: [], notes: '', fee: 500, createdAt: new Date(), updatedAt: new Date() },
    { sessionId: 's3', patientId: 'p1', patientName: 'Priya', workerId: 'w2', workerName: 'Amit Verma',
      date: new Date('2026-10-22'), timeSlot: '09:00 AM - 09:30 AM', duration: 30, status: 'completed',
      therapies: [], notes: '', fee: 500, createdAt: new Date(), updatedAt: new Date() },
    { sessionId: 's4', patientId: 'p1', patientName: 'Priya', workerId: 'w1', workerName: 'Rahul Sharma',
      date: new Date('2026-10-30'), timeSlot: '10:00 AM - 10:30 AM', duration: 0, status: 'pending',
      therapies: [], notes: '', fee: 500, createdAt: new Date(), updatedAt: new Date() },
  ];

  filteredSessions = computed(() => {
    const tab = this.activeTab();
    if (tab === 'All') return this.allSessions;
    const statusMap: Record<FilterTab, SessionStatus> = {
      'All': 'pending', 'Completed': 'completed', 'Pending': 'pending'
    };
    return this.allSessions.filter(s => s.status === statusMap[tab]);
  });

  setTab(tab: FilterTab) { this.activeTab.set(tab); }
}
