import { Injectable, signal, computed } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { Session, SessionStatus, TherapyItem, DEFAULT_THERAPIES } from '../models/session.model';
import { where, orderBy } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SessionService {
  // Timer Signals
  private _timerSeconds = signal<number>(0);
  private _timerRunning = signal<boolean>(false);
  private _timerInterval: ReturnType<typeof setInterval> | null = null;
  private _activeSession = signal<Session | null>(null);

  // Public computed
  readonly timerDisplay = computed(() => {
    const s = this._timerSeconds();
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
  });
  readonly timerRunning = this._timerRunning.asReadonly();
  readonly timerSeconds = this._timerSeconds.asReadonly();
  readonly activeSession = this._activeSession.asReadonly();

  constructor(private firestoreService: FirestoreService) {}

  // ─── Timer Controls ───────────────────────────────────────────────────────

  startTimer(): void {
    if (this._timerRunning()) return;
    this._timerRunning.set(true);
    this._timerInterval = setInterval(() => {
      this._timerSeconds.update(s => s + 1);
    }, 1000);
  }

  pauseTimer(): void {
    this._timerRunning.set(false);
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  }

  resetTimer(): void {
    this.pauseTimer();
    this._timerSeconds.set(0);
  }

  // ─── Session CRUD ─────────────────────────────────────────────────────────

  getSessionsByWorker(workerId: string): Observable<Session[]> {
    return this.firestoreService.watchCollection<Session>(
      'sessions',
      where('workerId', '==', workerId),
      orderBy('date', 'desc')
    );
  }

  getTodaySessionsByWorker(workerId: string): Observable<Session[]> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    return this.firestoreService.watchCollection<Session>(
      'sessions',
      where('workerId', '==', workerId),
      where('date', '>=', startOfDay),
      where('date', '<=', endOfDay)
    );
  }

  getSessionsByPatient(patientId: string): Observable<Session[]> {
    return this.firestoreService.watchCollection<Session>(
      'sessions',
      where('patientId', '==', patientId),
      orderBy('date', 'desc')
    );
  }

  startSession(session: Session): Observable<void> {
    this._activeSession.set(session);
    this.startTimer();
    return this.firestoreService.updateDoc('sessions', session.sessionId, {
      status: 'active' as SessionStatus,
      updatedAt: new Date()
    });
  }

  endSession(sessionId: string, notes: string, therapies: TherapyItem[]): Observable<void> {
    const duration = Math.ceil(this._timerSeconds() / 60);
    this.resetTimer();
    this._activeSession.set(null);
    return this.firestoreService.updateDoc('sessions', sessionId, {
      status: 'completed' as SessionStatus,
      duration,
      notes,
      therapies,
      updatedAt: new Date()
    });
  }

  updateSessionStatus(sessionId: string, status: SessionStatus): Observable<void> {
    return this.firestoreService.updateDoc('sessions', sessionId, {
      status,
      updatedAt: new Date()
    });
  }

  getDefaultTherapies(): TherapyItem[] {
    return DEFAULT_THERAPIES.map(t => ({ ...t }));
  }

  getSessionFee(durationMinutes: number): number {
    // ₹500 for 30 min session base rate
    const baseRate = 500;
    const multiplier = Math.ceil(durationMinutes / 30);
    return baseRate * multiplier;
  }
}
