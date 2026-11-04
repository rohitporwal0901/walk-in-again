import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { PaymentService } from '../../core/services/payment.service';
import { PricingService } from '../../core/services/pricing.service';
import { Session } from '../../core/models/session.model';
import { UserSubscription } from '../../core/models/subscription.model';
import { Unsubscribe } from '@angular/fire/firestore';

@Component({
  selector: 'app-patient-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './patient-home.component.html',
  styleUrl: './patient-home.component.scss'
})
export class PatientHomeComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private sessionService = inject(SessionService);
  private subscriptionService = inject(SubscriptionService);
  private paymentService = inject(PaymentService);
  public pricingService = inject(PricingService);
  private router = inject(Router);

  readonly defaultWalkInFee = this.pricingService.walkInFee;

  private sessionsUnsub: Unsubscribe | null = null;
  private subUnsub: Unsubscribe | null = null;
  private loadTimeout: any = null;

  private sessionsLoaded = false;
  private subLoaded = false;

  readonly patientName = this.auth.userName;
  readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  });

  isLoading = signal<boolean>(true);
  isPaying = signal<boolean>(false);

  // Real Firestore sessions for current patient
  patientSessions = signal<Session[]>([]);
  activePlanSub = signal<UserSubscription | null>(null);

  // Computed Session States
  pendingOtpSession = computed(() =>
    this.patientSessions().find(s => s.status === 'pending_otp') || null
  );

  activeSession = computed(() =>
    this.patientSessions().find(s => s.status === 'active') || null
  );

  unpaidCompletedSession = computed(() =>
    this.patientSessions().find(s =>
      s.status === 'completed' &&
      s.paymentStatus === 'pending' &&
      (s.fee ?? 0) > 0 &&
      !s.isCoveredBySubscription
    ) || null
  );

  completedSessions = computed(() => {
    const sub = this.activePlanSub();
    if (sub && sub.totalSessions) {
      // Isolate current active plan: only sessions used in this plan count!
      return Math.max(0, sub.totalSessions - (sub.remainingSessions ?? sub.totalSessions));
    }
    // If NO active subscription, count regular walk-in completed & paid sessions
    return this.patientSessions().filter(s =>
      s.status === 'completed' &&
      s.paymentStatus === 'paid' &&
      !s.isCoveredBySubscription
    ).length;
  });

  totalRecommendedSessions = computed(() => {
    const sub = this.activePlanSub();
    if (sub && sub.totalSessions) {
      return sub.totalSessions;
    }
    const done = this.completedSessions();
    return Math.max(10, done + 2);
  });

  progressPercent = computed(() => {
    const total = this.totalRecommendedSessions();
    if (total === 0) return 0;
    return Math.min(100, Math.round((this.completedSessions() / total) * 100));
  });

  isSubscriber = computed(() => !!this.activePlanSub());

  planRemainingDays = computed(() => {
    const sub = this.activePlanSub();
    if (!sub?.expiryDate) return null;
    try {
      const exp = new Date(sub.expiryDate).getTime();
      const now = new Date().getTime();
      const diff = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
      return Math.max(0, diff);
    } catch {
      return null;
    }
  });

  quickActions = [
    { id: 'action-sessions', label: 'Sessions', route: '/patient/sessions', bg: '#FEF9C3', iconBg: '#FEF08A', color: '#854D0E', type: 'sessions' },
    { id: 'action-payments', label: 'Payments', route: '/patient/payments', bg: '#F3E8FF', iconBg: '#E9D5FF', color: '#6B21A8', type: 'payments' },
    { id: 'action-plans', label: 'Plans', route: '/patient/subscription', bg: '#FFEDD5', iconBg: '#FED7AA', color: '#9A3412', type: 'plans' },
    { id: 'action-homecare', label: 'Home Care', route: '/patient/sessions', bg: '#DCFCE7', iconBg: '#BBF7D0', color: '#166534', type: 'homecare' },
  ];

  private checkLoaded() {
    if (this.sessionsLoaded && this.subLoaded) {
      this.isLoading.set(false);
      if (this.loadTimeout) {
        clearTimeout(this.loadTimeout);
        this.loadTimeout = null;
      }
    }
  }

  ngOnInit() {
    const user = this.auth.currentUser();
    if (user?.uid) {
      this.sessionsUnsub = this.sessionService.listenToPatientSessions(user.uid, (sessions) => {
        this.patientSessions.set(sessions);
        this.sessionsLoaded = true;
        this.checkLoaded();
      });
      this.subUnsub = this.subscriptionService.watchPatientSubscription(user.uid, (sub) => {
        this.activePlanSub.set(sub);
        this.subLoaded = true;
        this.checkLoaded();
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
    if (this.subUnsub) {
      this.subUnsub();
      this.subUnsub = null;
    }
  }

  /** Patient pays for completed session */
  async payForSession(session: Session) {
    if (this.isPaying()) return;
    this.isPaying.set(true);

    try {
      const user = this.auth.currentUser();
      const fee = session.fee || this.pricingService.walkInFee();

      const response = await this.paymentService.openPayment({
        amount: fee,
        patientName: user?.name || session.patientName,
        patientMobile: user?.mobileNumber || session.patientMobile || '9876543210',
        description: `Physiotherapy Care Session Fee — Dr. ${session.workerName}`
      });

      await this.sessionService.saveTransaction({
        sessionId: session.sessionId,
        patientId: user?.uid || session.patientId,
        patientName: user?.name || session.patientName,
        patientMobile: user?.mobileNumber || session.patientMobile || '',
        workerId: session.workerId,
        workerName: session.workerName,
        workerMobile: session.workerMobile,
        amount: fee,
        paymentMethod: 'UPI',
        razorpayPaymentId: response.razorpay_payment_id || '',
        durationMinutes: session.duration || 30
      });

      // Mark session as paid in Firestore (advances progress bar and clears due prompt)
      await this.sessionService.markSessionAsPaid(
        session.sessionId,
        'UPI',
        response.razorpay_payment_id
      );

      this.isPaying.set(false);
      this.router.navigate(['/patient/payments']);
    } catch (err: any) {
      console.warn('Patient payment cancelled:', err);
      this.isPaying.set(false);
    }
  }

  navigate(route: string) {
    this.router.navigate([route]);
  }
}
