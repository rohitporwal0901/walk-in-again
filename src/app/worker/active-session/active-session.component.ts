import { Component, signal, computed, inject, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { PaymentService } from '../../core/services/payment.service';
import { AuthService } from '../../core/services/auth.service';
import { TherapyItem, Session, calculateSessionEarning } from '../../core/models/session.model';
import { Unsubscribe } from '@angular/fire/firestore';

@Component({
  selector: 'app-active-session',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './active-session.component.html',
  styleUrl: './active-session.component.scss'
})
export class ActiveSessionComponent implements OnInit, OnDestroy {
  private sessionService = inject(SessionService);
  private paymentService = inject(PaymentService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private sessionUnsub: Unsubscribe | null = null;

  // Signals from session service
  readonly timerDisplay = this.sessionService.timerDisplay;
  readonly timerRunning = this.sessionService.timerRunning;

  // Local signals
  sessionId = signal<string>('');
  patientId = signal<string>('');
  patientName = signal<string>('Patient');
  patientMobile = signal<string>('');
  patientCondition = signal<string>('Physiotherapy Consultation');
  therapies = signal<TherapyItem[]>([]);
  sessionNotes = signal<string>('');
  showSummary = signal<boolean>(false);
  isEndingSession = signal<boolean>(false);
  selectedPaymentMethod = signal<'UPI' | 'Card' | 'Cash'>('UPI');
  timeDisplayNow = signal<string>(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  // Rapido-Style Swipe to End Session State
  swipeOffset = signal<number>(0);
  swipeProgress = signal<number>(0);
  isSwiping = signal<boolean>(false);
  swipeCompleted = signal<boolean>(false);
  private startTouchX = 0;
  private maxSwipeDistance = 260;

  isCoveredByPlan = signal<boolean>(false);
  planName = signal<string>('');
  sessionValue = signal<number>(500);
  showDirectPay = signal<boolean>(false);

  sessionDuration = computed(() => Math.max(1, Math.ceil(this.sessionService.timerSeconds() / 60)));
  sessionFee = computed(() => this.isCoveredByPlan() ? 0 : this.sessionService.getSessionFee(this.sessionDuration()));
  completedTherapiesCount = computed(() => this.therapies().filter(t => t.checked).length);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('sessionId') || '';
    this.sessionId.set(id);
    this.therapies.set(this.sessionService.getDefaultTherapies());

    if (id) {
      this.sessionUnsub = this.sessionService.listenToSession(id, (sess: Session | null) => {
        if (sess) {
          if (sess.patientName) this.patientName.set(sess.patientName);
          if (sess.patientId) this.patientId.set(sess.patientId);
          if (sess.patientMobile) this.patientMobile.set(sess.patientMobile);
          if (sess.notes) this.patientCondition.set(sess.notes);
          if (sess.isCoveredBySubscription || sess.fee === 0) {
            this.isCoveredByPlan.set(true);
            if (sess.planName) this.planName.set(sess.planName);
          }
          const earningVal = calculateSessionEarning(sess);
          this.sessionValue.set(earningVal);
          if (sess.therapies && sess.therapies.length > 0) {
            this.therapies.set(sess.therapies);
          }
        }
      });
    }

    this.sessionService.startTimer();
  }

  ngOnDestroy() {
    if (this.sessionUnsub) {
      this.sessionUnsub();
      this.sessionUnsub = null;
    }
  }

  getTimerDashOffset(): number {
    const totalCircumference = 578; // 2 * PI * 92
    const currentSeconds = this.sessionService.timerSeconds();
    // Target 30-minute typical session
    const targetSeconds = 1800;
    const progress = Math.min(1, currentSeconds / targetSeconds);
    return Math.max(0, totalCircumference - (progress * totalCircumference));
  }

  togglePause() {
    if (this.timerRunning()) {
      this.sessionService.pauseTimer();
    } else {
      this.sessionService.startTimer();
    }
  }

  toggleTherapy(index: number) {
    this.therapies.update(list => {
      const updated = [...list];
      updated[index] = { ...updated[index], checked: !updated[index].checked };
      return updated;
    });
  }

  updateNotes(value: string) {
    this.sessionNotes.set(value);
  }

  endSession() {
    this.sessionService.pauseTimer();
    this.timeDisplayNow.set(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    this.showSummary.set(true);
  }

  resumeSession() {
    this.showSummary.set(false);
    this.sessionService.startTimer();
    this.resetSwipe();
  }

  // ─── Swipe Slider Gesture Controls (Rapido Style) ──────────────────────────
  onSwipeStart(event: TouchEvent | MouseEvent) {
    if (this.swipeCompleted()) return;
    this.isSwiping.set(true);
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    this.startTouchX = clientX - this.swipeOffset();

    const container = document.getElementById('swipe-container');
    if (container) {
      const containerWidth = container.clientWidth;
      this.maxSwipeDistance = Math.max(120, containerWidth - 58);
    }
  }

  onSwipeMove(event: TouchEvent | MouseEvent) {
    if (!this.isSwiping() || this.swipeCompleted()) return;
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const rawDelta = clientX - this.startTouchX;
    const clamped = Math.max(0, Math.min(rawDelta, this.maxSwipeDistance));
    this.swipeOffset.set(clamped);
    this.swipeProgress.set(clamped / this.maxSwipeDistance);
  }

  onSwipeEnd() {
    if (!this.isSwiping() || this.swipeCompleted()) return;
    this.isSwiping.set(false);

    if (this.swipeProgress() >= 0.70) {
      // Completed swipe: snap to end and trigger endSession
      this.swipeOffset.set(this.maxSwipeDistance);
      this.swipeProgress.set(1);
      this.swipeCompleted.set(true);

      setTimeout(() => {
        this.endSession();
      }, 250);
    } else {
      // Revert smoothly
      this.swipeOffset.set(0);
      this.swipeProgress.set(0);
    }
  }

  resetSwipe() {
    this.swipeOffset.set(0);
    this.swipeProgress.set(0);
    this.isSwiping.set(false);
    this.swipeCompleted.set(false);
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent) {
    if (this.isSwiping()) {
      this.onSwipeMove(event);
    }
  }

  @HostListener('window:mouseup')
  onWindowMouseUp() {
    if (this.isSwiping()) {
      this.onSwipeEnd();
    }
  }

  /**
   * Primary Action: Worker ends session.
   * If covered by plan: session completes as paid, 1 session is deducted from plan.
   * If not covered: session ends as 'pending' so patient can pay from their own phone!
   */
  async endSessionAndBillPatient() {
    this.isEndingSession.set(true);
    try {
      const isCovered = this.isCoveredByPlan();
      const fee = isCovered ? 0 : this.sessionFee();

      if (isCovered) {
        const user = this.authService.currentUser();
        await this.sessionService.saveTransaction({
          sessionId: this.sessionId(),
          patientId: this.patientId() || this.patientMobile() || 'walkin',
          patientName: this.patientName(),
          patientMobile: this.patientMobile(),
          workerId: user?.uid || '',
          workerName: user?.name || 'Physiotherapist',
          workerMobile: user?.mobileNumber || '',
          amount: this.sessionValue(),
          paymentMethod: 'Subscription',
          razorpayPaymentId: `SUB_${this.planName() || 'Plan'}`,
          durationMinutes: this.sessionDuration()
        });
      }

      await this.sessionService.endSession(
        this.sessionId(),
        this.sessionNotes(),
        this.therapies(),
        fee,
        this.sessionDuration(),
        isCovered ? 'paid' : 'pending'
      );

      this.router.navigate(['/worker/dashboard']);
    } catch (err: any) {
      console.error('Session completion error:', err);
      alert(err?.message || 'Error ending session.');
      this.isEndingSession.set(false);
    }
  }

  /**
   * Secondary Action: If patient pays cash or direct to the worker on the spot.
   */
  async collectPaymentDirectly() {
    this.isEndingSession.set(true);
    try {
      const fee = this.sessionFee();
      const user = this.authService.currentUser();
      const method = this.selectedPaymentMethod();
      let razorpayPaymentId = '';

      if (method === 'UPI' || method === 'Card') {
        try {
          const response = await this.paymentService.openPayment({
            amount: fee,
            patientName: this.patientName(),
            patientMobile: this.patientMobile() || '9876543210',
            description: `Walk In Physio Session — ${this.patientCondition()}`
          });
          razorpayPaymentId = response.razorpay_payment_id || '';
        } catch (paymentErr) {
          console.warn('Direct worker payment cancelled:', paymentErr);
          this.isEndingSession.set(false);
          return;
        }
      }

      // Record transaction
      await this.sessionService.saveTransaction({
        sessionId: this.sessionId(),
        patientId: this.patientId() || this.patientMobile() || 'walkin',
        patientName: this.patientName(),
        patientMobile: this.patientMobile(),
        workerId: user?.uid || '',
        workerName: user?.name || 'Physiotherapist',
        workerMobile: user?.mobileNumber || '',
        amount: fee,
        paymentMethod: method,
        razorpayPaymentId,
        durationMinutes: this.sessionDuration()
      });

      // Complete session document as 'paid'
      await this.sessionService.endSession(
        this.sessionId(),
        this.sessionNotes(),
        this.therapies(),
        fee,
        this.sessionDuration(),
        'paid'
      );

      this.router.navigate(['/worker/dashboard']);
    } catch (err: any) {
      console.error('Payment / Session completion error:', err);
      alert(err?.message || 'Error completing session.');
      this.isEndingSession.set(false);
    }
  }

  /** Alias for backward compatibility */
  async proceedToPayment() {
    return this.endSessionAndBillPatient();
  }

  goBack() {
    this.router.navigate(['/worker/dashboard']);
  }
}
