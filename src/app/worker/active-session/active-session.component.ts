import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { PaymentService } from '../../core/services/payment.service';
import { AuthService } from '../../core/services/auth.service';
import { TherapyItem } from '../../core/models/session.model';

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

  // Signals from session service
  readonly timerDisplay = this.sessionService.timerDisplay;
  readonly timerRunning = this.sessionService.timerRunning;

  // Local signals
  sessionId = signal<string>('');
  patientName = signal<string>('Anita Sharma');
  patientCondition = signal<string>('Knee Pain');
  therapies = signal<TherapyItem[]>([]);
  sessionNotes = signal<string>('');
  showSummary = signal<boolean>(false);
  isEndingSession = signal<boolean>(false);
  selectedPaymentMethod = signal<'UPI' | 'Card' | 'Cash'>('UPI');

  sessionDuration = computed(() => Math.ceil(this.sessionService.timerSeconds() / 60));
  sessionFee = computed(() => this.sessionService.getSessionFee(this.sessionDuration()));

  ngOnInit() {
    this.sessionId.set(this.route.snapshot.paramMap.get('sessionId') || 'sess_001');
    this.therapies.set(this.sessionService.getDefaultTherapies());
    this.sessionService.startTimer();
  }

  ngOnDestroy() {
    // Don't reset timer on destroy; reset only on End Session
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

      if (this.selectedPaymentMethod() === 'UPI' || this.selectedPaymentMethod() === 'Card') {
        const response = await this.paymentService.openPayment({
          amount: fee,
          patientName: this.patientName(),
          patientMobile: '9876543210',
          description: `Physiotherapy Session — ${this.patientCondition()}`
        });
        // Save transaction
        this.paymentService.saveTransaction({
          sessionId: this.sessionId(),
          patientId: 'p1',
          patientName: this.patientName(),
          patientMobile: '9876543210',
          workerId: user?.mobileNumber || '',
          workerName: user?.name || '',
          workerMobile: user?.mobileNumber || '',
          amount: fee,
          paymentMethod: this.selectedPaymentMethod(),
          razorpayPaymentId: response.razorpay_payment_id,
          status: 'Paid',
          sessionDate: new Date(),
          sessionTimeSlot: '10:00 AM - 10:30 AM',
          sessionDuration: this.sessionDuration(),
          timestamp: new Date()
        }).subscribe();
      }

      // End session in Firestore
      this.sessionService.endSession(
        this.sessionId(),
        this.sessionNotes(),
        this.therapies()
      ).subscribe();

      this.router.navigate(['/worker/dashboard']);
    } catch (err) {
      this.isEndingSession.set(false);
    }
  }

  goBack() {
    this.router.navigate(['/worker/dashboard']);
  }
}
