import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SubscriptionService } from '../../core/services/subscription.service';
import { PaymentService } from '../../core/services/payment.service';
import { AuthService } from '../../core/services/auth.service';
import { SubscriptionPlan, UserSubscription } from '../../core/models/subscription.model';
import { Unsubscribe } from '@angular/fire/firestore';

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './subscription.component.html',
  styleUrl: './subscription.component.scss'
})
export class SubscriptionComponent implements OnInit, OnDestroy {
  private subService = inject(SubscriptionService);
  private paymentService = inject(PaymentService);
  private authService = inject(AuthService);
  private router = inject(Router);

  plans = signal<SubscriptionPlan[]>([]);
  activeSub = signal<UserSubscription | null>(null);
  isLoading = signal(true);
  isPurchasing = signal(false);
  selectedPlan = signal<SubscriptionPlan | null>(null);
  showPaymentSheet = signal(false);
  selectedMethod = signal<'UPI' | 'Card' | 'Cash'>('UPI');
  purchaseSuccess = signal(false);
  errorMsg = signal('');

  private subUnsub: Unsubscribe | null = null;

  async ngOnInit() {
    // Seed default plans to Firestore if not already there
    await this.subService.seedDefaultPlans();
    const plans = await this.subService.getPlans();
    this.plans.set(plans);
    this.isLoading.set(false);

    const user = this.authService.currentUser();
    if (user?.uid) {
      this.subUnsub = this.subService.watchPatientSubscription(user.uid, (sub) => {
        this.activeSub.set(sub);
      });
    }
  }

  ngOnDestroy() {
    this.subUnsub?.();
  }

  selectPlan(plan: SubscriptionPlan) {
    this.selectedPlan.set(plan);
    this.showPaymentSheet.set(true);
    this.errorMsg.set('');
  }

  closeSheet() {
    this.showPaymentSheet.set(false);
    this.selectedPlan.set(null);
  }

  async confirmPurchase() {
    const plan = this.selectedPlan();
    const user = this.authService.currentUser();
    if (!plan || !user) return;

    this.isPurchasing.set(true);
    this.errorMsg.set('');

    try {
      let razorpayPaymentId = '';
      const method = this.selectedMethod();

      if (method === 'UPI' || method === 'Card') {
        const response = await this.paymentService.openPayment({
          amount: plan.price,
          patientName: user.name,
          patientMobile: user.mobileNumber,
          description: `Walk In Physio — ${plan.name} Plan (${plan.sessions} Sessions)`
        });
        razorpayPaymentId = response.razorpay_payment_id || '';
      }

      await this.subService.purchaseSubscription({
        patientId: user.uid,
        patientName: user.name,
        plan,
        paymentMethod: method,
        razorpayPaymentId
      });

      this.showPaymentSheet.set(false);
      this.purchaseSuccess.set(true);
      setTimeout(() => this.purchaseSuccess.set(false), 4000);
    } catch (err: any) {
      this.errorMsg.set(err?.message || 'Payment failed. Please try again.');
    } finally {
      this.isPurchasing.set(false);
    }
  }

  goBack() {
    this.router.navigate(['/patient/home']);
  }
}
