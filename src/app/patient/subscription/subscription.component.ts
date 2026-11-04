import { Component, signal, computed, inject, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
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
  @ViewChild('confettiCanvas') confettiCanvasRef?: ElementRef<HTMLCanvasElement>;

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
  lastPurchasedPlan = signal<SubscriptionPlan | null>(null);
  showPaymentSheet = signal(false);
  selectedMethod = signal<'UPI' | 'Card' | 'Cash'>('UPI');
  purchaseSuccess = signal(false);
  errorMsg = signal('');

  private subUnsub: Unsubscribe | null = null;
  private plansUnsub: Unsubscribe | null = null;
  private confettiAnimId: number | null = null;
  private autoCloseTimer: any = null;

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
    if (this.confettiAnimId) {
      cancelAnimationFrame(this.confettiAnimId);
      this.confettiAnimId = null;
    }
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
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

  closeCelebration() {
    this.purchaseSuccess.set(false);
    if (this.confettiAnimId) {
      cancelAnimationFrame(this.confettiAnimId);
      this.confettiAnimId = null;
    }
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
    const canvas = this.confettiCanvasRef?.nativeElement;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
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

      this.lastPurchasedPlan.set(plan);
      this.showPaymentSheet.set(false);
      this.purchaseSuccess.set(true);
      setTimeout(() => this.launchConfetti(), 40);

      if (this.autoCloseTimer) clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = setTimeout(() => {
        this.closeCelebration();
      }, 5500);
    } catch (err: any) {
      this.errorMsg.set(err?.message || 'Payment failed. Please try again.');
    } finally {
      this.isPurchasing.set(false);
    }
  }

  launchConfetti() {
    const canvas = this.confettiCanvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (this.confettiAnimId) {
      cancelAnimationFrame(this.confettiAnimId);
      this.confettiAnimId = null;
    }

    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      sizeW: number;
      sizeH: number;
      color: string;
      rotation: number;
      rotationSpeed: number;
      wobble: number;
      wobbleSpeed: number;
      opacity: number;
      decay: number;
      shape: 'rect' | 'circle';
    }

    const colors = [
      '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6',
      '#EC4899', '#F59E0B', '#EF4444', '#14B8A6',
      '#FACC15', '#6366F1'
    ];

    const particles: Particle[] = [];
    const count = 180;

    for (let i = 0; i < count; i++) {
      const emitterChoice = i % 5;
      let startX: number;
      let startY: number;
      let angle: number;
      let speed: number;

      if (emitterChoice < 2) {
        // Left Cannon
        startX = width * 0.15;
        startY = height * 0.85;
        angle = (Math.PI / 180) * (45 + Math.random() * 40);
        speed = 16 + Math.random() * 16;
      } else if (emitterChoice < 4) {
        // Right Cannon
        startX = width * 0.85;
        startY = height * 0.85;
        angle = (Math.PI / 180) * (95 + Math.random() * 40);
        speed = 16 + Math.random() * 16;
      } else {
        // Center burst
        startX = width * 0.5;
        startY = height * 0.65;
        angle = (Math.PI / 180) * (60 + Math.random() * 60);
        speed = 14 + Math.random() * 20;
      }

      const vx = Math.cos(angle) * (emitterChoice >= 2 && emitterChoice < 4 ? -speed : speed);
      const vy = -Math.sin(angle) * speed;

      particles.push({
        x: startX,
        y: startY,
        vx,
        vy,
        sizeW: 7 + Math.random() * 7,
        sizeH: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.25,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.08 + Math.random() * 0.1,
        opacity: 1,
        decay: 0.003 + Math.random() * 0.004,
        shape: Math.random() > 0.25 ? 'rect' : 'circle'
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      let aliveCount = 0;

      for (const p of particles) {
        p.vx *= 0.98;
        p.vy += 0.38;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.wobble += p.wobbleSpeed;
        p.opacity -= p.decay;

        if (p.opacity > 0 && p.y < height + 40) {
          aliveCount++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.scale(1, Math.cos(p.wobble));
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, Math.min(1, p.opacity));

          if (p.shape === 'rect') {
            ctx.fillRect(-p.sizeW / 2, -p.sizeH / 2, p.sizeW, p.sizeH);
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.sizeW / 2.5, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }
      }

      if (aliveCount > 0) {
        this.confettiAnimId = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, width, height);
        this.confettiAnimId = null;
      }
    };

    this.confettiAnimId = requestAnimationFrame(animate);
  }

  goBack() {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/patient/home']);
    }
  }
}
