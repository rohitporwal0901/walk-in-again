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
  getDocs,
  Unsubscribe
} from '@angular/fire/firestore';
import { Session, SessionStatus, TherapyItem, DEFAULT_THERAPIES } from '../models/session.model';
import { Transaction } from '../models/transaction.model';
import { SubscriptionService } from './subscription.service';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private firestore = inject(Firestore);
  private subscriptionService = inject(SubscriptionService);

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

  /** Get active or pending session for a patient (prevents duplicate sessions) */
  async getActiveSessionForPatient(patientId: string): Promise<Session | null> {
    try {
      const colRef = collection(this.firestore, 'sessions');
      // Query active or pending_otp sessions
      const q = query(
        colRef,
        where('patientId', '==', patientId),
        where('status', 'in', ['active', 'pending_otp'])
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs[0].data() as Session;
      }
      return null;
    } catch (e) {
      console.warn('Could not check active session with compound query:', e);
      // Fallback in case index is not built: check patient's recent sessions
      try {
        const colRef = collection(this.firestore, 'sessions');
        const q = query(colRef, where('patientId', '==', patientId));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          const s = d.data() as Session;
          if (s.status === 'active' || s.status === 'pending_otp') {
            return s;
          }
        }
      } catch (err) {
        console.error('Fallback query error:', err);
      }
      return null;
    }
  }

  /** Real-time listener for all active / pending sessions across clinic */
  listenToActiveClinicSessions(callback: (sessions: Session[]) => void): Unsubscribe {
    const colRef = collection(this.firestore, 'sessions');
    return onSnapshot(colRef, snap => {
      const activeList: Session[] = [];
      snap.forEach(d => {
        const s = d.data() as Session;
        if (s.status === 'active' || s.status === 'pending_otp') {
          activeList.push(s);
        }
      });
      callback(activeList);
    }, err => {
      console.error('Error listening to active clinic sessions:', err);
      callback([]);
    });
  }

  /**
   * Create a new session with OTP (Worker starts session request)
   * Enforces that a patient CANNOT have two active sessions simultaneously.
   */
  async createSessionWithOtp(data: {
    patientId: string;
    patientName: string;
    patientMobile: string;
    workerId: string;
    workerName: string;
    workerMobile?: string;
    notes?: string;
  }): Promise<{ sessionId: string; otp: string }> {
    // 1. Strict Duplicate Check: Cannot start another session if patient already has an active session
    const existing = await this.getActiveSessionForPatient(data.patientId);
    if (existing) {
      throw new Error(`Patient ${data.patientName} already has an active session in progress.`);
    }

    // 2. Standard Firestore Auto-Generated Document ID
    const sessionRef = doc(collection(this.firestore, 'sessions'));
    const sessionId = sessionRef.id;

    // 3. Check if patient has an active subscription plan
    const activeSub = await this.subscriptionService.getActiveSubscription(data.patientId);
    const isCovered = !!(activeSub && (activeSub.remainingSessions ?? 0) > 0);
    const fee = isCovered ? 0 : 500;
    const paymentStatus: 'paid' | 'pending' = isCovered ? 'paid' : 'pending';

    // 4. Generate 4-digit OTP for patient verification
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

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
      status: 'pending_otp' as SessionStatus,
      otp,
      paymentStatus,
      isCoveredBySubscription: isCovered,
      planName: isCovered ? activeSub?.planName : '',
      therapies: this.getDefaultTherapies(),
      notes: data.notes || '',
      fee,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    await setDoc(sessionRef, newSession);
    return { sessionId, otp };
  }

  /** Verify patient OTP and start active session timer */
  async verifyAndStartSession(sessionId: string, enteredOtp: string): Promise<{ success: boolean; message?: string }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return { success: false, message: 'Session record not found.' };
    }

    if (session.otp !== enteredOtp.trim()) {
      return { success: false, message: 'Incorrect OTP. Please enter the 4-digit code shown on patient\'s screen.' };
    }

    const sessionRef = doc(this.firestore, 'sessions', sessionId);
    const now = new Date().toISOString();
    await updateDoc(sessionRef, {
      status: 'active' as SessionStatus,
      startedAt: now,
      updatedAt: now
    });

    this.resetTimer();
    this.startTimer();
    return { success: true };
  }

  /** Create a new session directly (legacy fallback) */
  async createSession(data: {
    patientId: string;
    patientName: string;
    patientMobile: string;
    workerId: string;
    workerName: string;
    workerMobile?: string;
    notes?: string;
  }): Promise<string> {
    const res = await this.createSessionWithOtp(data);
    return res.sessionId;
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
    return onSnapshot(colRef, snap => {
      const list: Session[] = [];
      snap.forEach(d => {
        const s = d.data() as Session;
        if (!workerIdentifier || !s.workerId || s.workerId === workerIdentifier || s.workerMobile === workerIdentifier) {
          list.push(s);
        }
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
    const sessionSnap = await getDoc(sessionRef);
    const sessData = sessionSnap.exists() ? (sessionSnap.data() as Session) : null;

    const isCovered = sessData?.isCoveredBySubscription || fee === 0;

    // If session is covered by patient's plan, deduct session & auto-expire if remaining reaches 0
    if (isCovered && sessData?.patientId) {
      await this.subscriptionService.decrementSession(sessData.patientId);
    }

    const now = new Date().toISOString();
    await updateDoc(sessionRef, {
      status: 'completed' as SessionStatus,
      duration: durationMinutes,
      notes,
      therapies,
      fee: isCovered ? 0 : fee,
      endedAt: now,
      paymentStatus: isCovered ? 'paid' : 'pending',
      updatedAt: now
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
    paymentMethod: 'UPI' | 'Card' | 'Cash' | 'Subscription';
    razorpayPaymentId?: string;
    durationMinutes: number;
  }): Promise<string> {
    // Standard Firestore Auto-Generated Document ID
    const txnRef = doc(collection(this.firestore, 'transactions'));
    const transactionId = txnRef.id;

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
