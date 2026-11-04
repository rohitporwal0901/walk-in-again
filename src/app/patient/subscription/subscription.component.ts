import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
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
  private location = inject(Location);

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
  private plansUnsub: Unsubscribe | null = null;

  planRemainingDays = computed(() => {
    const sub = this.activeSub();
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

  planProgressPercent = computed(() => {
    const sub = this.activeSub();
    if (!sub || !sub.totalSessions) return 0;
    const completed = sub.totalSessions - sub.remainingSessions;
    return Math.min(100, Math.round((completed / sub.totalSessions) * 100));
  });

  async ngOnInit() {
    this.plansUnsub = this.subService.watchPlans((plans) => {
      this.plans.set(plans);
      this.isLoading.set(false);
    });

    const user = this.authService.currentUser();
    if (user?.uid) {
      this.subUnsub = this.subService.watchPatientSubscription(user.uid, (sub) => {
        this.activeSub.set(sub);
      });
    }
  }

  ngOnDestroy() {
    this.subUnsub?.();
    this.plansUnsub?.();
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
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/patient/home']);
    }
  }
}
