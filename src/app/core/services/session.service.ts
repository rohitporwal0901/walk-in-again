import { Injectable, signal, computed, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  Unsubscribe
} from '@angular/fire/firestore';
import { Session, SessionStatus, TherapyItem, DEFAULT_THERAPIES } from '../models/session.model';
import { Transaction } from '../models/transaction.model';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private firestore = inject(Firestore);

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

  // ─── Session Management ───────────────────────────────────────────────────

  /** Create a new session (e.g. walk-in intake by Worker) */
  async createSession(data: {
    patientId: string;
    patientName: string;
    patientMobile: string;
    workerId: string;
    workerName: string;
    workerMobile?: string;
    notes?: string;
  }): Promise<string> {
    const sessionId = `sess_${Date.now()}`;
    const sessionRef = doc(this.firestore, 'sessions', sessionId);

    const now = new Date();
    const timeSlot = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newSession: Record<string, any> = {
      sessionId,
      patientId: data.patientId,
      patientName: data.patientName,
      patientMobile: data.patientMobile,
      workerId: data.workerId,
      workerName: data.workerName,
      workerMobile: data.workerMobile || '',
      date: now.toISOString(),
      timeSlot,
      duration: 0,
      status: 'active' as SessionStatus,
      therapies: this.getDefaultTherapies(),
      notes: data.notes || '',
      fee: 500,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    await setDoc(sessionRef, newSession);
    return sessionId;
  }

  /** Get single session by ID */
  async getSession(sessionId: string): Promise<Session | null> {
    try {
      const snap = await getDoc(doc(this.firestore, 'sessions', sessionId));
      if (!snap.exists()) return null;
      return snap.data() as Session;
    } catch (e) {
      console.error('Error fetching session:', e);
      return null;
    }
  }

  /** Real-time listener for a single session */
  listenToSession(sessionId: string, callback: (session: Session | null) => void): Unsubscribe {
    const sessionRef = doc(this.firestore, 'sessions', sessionId);
    return onSnapshot(sessionRef, snap => {
      if (snap.exists()) {
        callback(snap.data() as Session);
      } else {
        callback(null);
      }
    }, err => {
      console.error('Error watching session:', err);
      callback(null);
    });
  }

  /** Real-time listener for all sessions for a specific patient */
  listenToPatientSessions(patientIdentifier: string, callback: (sessions: Session[]) => void): Unsubscribe {
    const colRef = collection(this.firestore, 'sessions');
    // Listen for patientId == patientIdentifier
    const q = query(colRef, where('patientId', '==', patientIdentifier));
    return onSnapshot(q, snap => {
      const list: Session[] = [];
      snap.forEach(d => {
        list.push(d.data() as Session);
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      callback(list);
    }, err => {
      console.error('Error watching patient sessions:', err);
      callback([]);
    });
  }

  /** Real-time listener for all sessions for a specific worker */
  listenToWorkerSessions(workerIdentifier: string, callback: (sessions: Session[]) => void): Unsubscribe {
    const colRef = collection(this.firestore, 'sessions');
    const q = query(colRef, where('workerId', '==', workerIdentifier));
    return onSnapshot(q, snap => {
      const list: Session[] = [];
      snap.forEach(d => {
        list.push(d.data() as Session);
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      callback(list);
    }, err => {
      console.error('Error watching worker sessions:', err);
      callback([]);
    });
  }

  /** End/Complete session */
  async endSession(
    sessionId: string,
    notes: string,
    therapies: TherapyItem[],
    fee: number,
    durationMinutes: number
  ): Promise<void> {
    this.resetTimer();
    this._activeSession.set(null);

    const sessionRef = doc(this.firestore, 'sessions', sessionId);
    await updateDoc(sessionRef, {
      status: 'completed' as SessionStatus,
      duration: durationMinutes,
      notes,
      therapies,
      fee,
      updatedAt: new Date().toISOString()
    });
  }

  /** Record completed payment transaction */
  async saveTransaction(data: {
    sessionId: string;
    patientId: string;
    patientName: string;
    patientMobile: string;
    workerId: string;
    workerName: string;
    workerMobile?: string;
    amount: number;
    paymentMethod: 'UPI' | 'Card' | 'Cash';
    razorpayPaymentId?: string;
    durationMinutes: number;
  }): Promise<string> {
    const transactionId = `txn_${Date.now()}`;
    const txnRef = doc(this.firestore, 'transactions', transactionId);

    const now = new Date();
    const timeSlot = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newTxn: Record<string, any> = {
      transactionId,
      sessionId: data.sessionId,
      patientId: data.patientId,
      patientName: data.patientName,
      patientMobile: data.patientMobile,
      workerId: data.workerId,
      workerName: data.workerName,
      workerMobile: data.workerMobile || '',
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      razorpayPaymentId: data.razorpayPaymentId || '',
      status: 'Paid',
      sessionDate: now.toISOString(),
      sessionTimeSlot: timeSlot,
      sessionDuration: data.durationMinutes,
      timestamp: now.toISOString()
    };

    await setDoc(txnRef, newTxn);

    // Also link transactionId in session
    try {
      const sessionRef = doc(this.firestore, 'sessions', data.sessionId);
      await updateDoc(sessionRef, {
        transactionId,
        updatedAt: now.toISOString()
      });
    } catch (e) {
      console.warn('Could not update session transactionId:', e);
    }

    return transactionId;
  }

  /** Real-time listener for patient's transactions */
  listenToPatientTransactions(patientIdentifier: string, callback: (txns: Transaction[]) => void): Unsubscribe {
    const colRef = collection(this.firestore, 'transactions');
    const q = query(colRef, where('patientId', '==', patientIdentifier));
    return onSnapshot(q, snap => {
      const list: Transaction[] = [];
      snap.forEach(d => {
        list.push(d.data() as Transaction);
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      callback(list);
    }, err => {
      console.error('Error watching patient transactions:', err);
      callback([]);
    });
  }

  getDefaultTherapies(): TherapyItem[] {
    return DEFAULT_THERAPIES.map(t => ({ ...t }));
  }

  getSessionFee(durationMinutes: number): number {
    const baseRate = 500;
    const multiplier = Math.max(1, Math.ceil(durationMinutes / 30));
    return baseRate * multiplier;
  }
}
