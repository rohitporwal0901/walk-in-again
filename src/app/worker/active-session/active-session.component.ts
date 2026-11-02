import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { PaymentService } from '../../core/services/payment.service';
import { AuthService } from '../../core/services/auth.service';
import { TherapyItem, Session } from '../../core/models/session.model';
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

  // Real Local signals populated from Firestore
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

  sessionDuration = computed(() => Math.max(1, Math.ceil(this.sessionService.timerSeconds() / 60)));
  sessionFee = computed(() => this.sessionService.getSessionFee(this.sessionDuration()));

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
    this.showSummary.set(true);
  }

  resumeSession() {
    this.showSummary.set(false);
    this.sessionService.startTimer();
  }

  async proceedToPayment() {
    this.isEndingSession.set(true);
    try {
      const fee = this.sessionFee();
      const user = this.authService.currentUser();
      const method = this.selectedPaymentMethod();
      let razorpayPaymentId = '';

      if (method === 'UPI' || method === 'Card') {
        const response = await this.paymentService.openPayment({
          amount: fee,
          patientName: this.patientName(),
          patientMobile: this.patientMobile() || '9876543210',
          description: `Walk In Physio Session — ${this.patientCondition()}`
        });
        razorpayPaymentId = response.razorpay_payment_id || '';
      }

      // Record real transaction in Firestore
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

      // Complete session document in Firestore
      await this.sessionService.endSession(
        this.sessionId(),
        this.sessionNotes(),
        this.therapies(),
        fee,
        this.sessionDuration()
      );

      this.router.navigate(['/worker/dashboard']);
    } catch (err: any) {
      console.error('Payment / Session completion error:', err);
      alert(err?.message || 'Payment was cancelled or failed. You can resume or select Cash.');
      this.isEndingSession.set(false);
    }
  }

  goBack() {
    this.router.navigate(['/worker/dashboard']);
  }
}
