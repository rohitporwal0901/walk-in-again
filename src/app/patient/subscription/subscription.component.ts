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
      setTimeout(() => this.launchConfetti(), 30);

      if (this.autoCloseTimer) clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = setTimeout(() => {
        this.closeCelebration();
      }, 6500);
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

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

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
      shape: 'rect' | 'circle' | 'sparkle';
      gravity: number;
      drag: number;
    }

    const colors = [
      '#0284C7', '#0D9488', '#10B981', '#3B82F6',
      '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444',
      '#FACC15', '#FFD700', '#14B8A6', '#6366F1'
    ];

    const particles: Particle[] = [];

    const spawnBurst = (count: number, isSecondWave = false) => {
      for (let i = 0; i < count; i++) {
        const emitter = i % 3;
        let startX: number;
        let startY: number;
        let angleDeg: number;
        let speed: number;

        if (emitter === 0) {
          // Left Cannon: launches towards center-right
          startX = width * 0.08;
          startY = height * 0.88;
          angleDeg = 48 + Math.random() * 32; // 48° to 80°
          speed = (isSecondWave ? 15 : 18) + Math.random() * 16;
        } else if (emitter === 1) {
          // Right Cannon: launches towards center-left
          startX = width * 0.92;
          startY = height * 0.88;
          angleDeg = 100 + Math.random() * 32; // 100° to 132°
          speed = (isSecondWave ? 15 : 18) + Math.random() * 16;
        } else {
          // Center fountain burst
          startX = width * (0.45 + Math.random() * 0.1);
          startY = height * 0.72;
          angleDeg = 75 + Math.random() * 30; // 75° to 105°
          speed = (isSecondWave ? 14 : 17) + Math.random() * 18;
        }

        const angleRad = (angleDeg * Math.PI) / 180;
        const vx = Math.cos(angleRad) * speed;
        const vy = -Math.sin(angleRad) * speed;

        const shapeRnd = Math.random();
        const shape: 'rect' | 'circle' | 'sparkle' =
          shapeRnd > 0.4 ? 'rect' : shapeRnd > 0.15 ? 'circle' : 'sparkle';

        particles.push({
          x: startX,
          y: startY,
          vx,
          vy,
          sizeW: 8 + Math.random() * 7,
          sizeH: 5 + Math.random() * 7,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.22,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.08 + Math.random() * 0.1,
          opacity: 1,
          decay: 0.003 + Math.random() * 0.004,
          shape,
          gravity: 0.32 + Math.random() * 0.08,
          drag: 0.97
        });
      }
    };

    // Wave 1: Immediate cannon blast (180 particles)
    spawnBurst(180, false);

    // Wave 2: Second celebratory wave after 320ms for full-screen fireworks
    setTimeout(() => {
      if (this.purchaseSuccess()) {
        spawnBurst(80, true);
      }
    }, 320);

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      let aliveCount = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.vx *= p.drag;
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.wobble += p.wobbleSpeed;

        // Start fading opacity after peak
        if (p.vy > 0) {
          p.opacity -= p.decay;
        }

        if (p.opacity > 0 && p.y < height + 60 && p.x > -60 && p.x < width + 60) {
          aliveCount++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.scale(1, Math.cos(p.wobble));
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, Math.min(1, p.opacity));

          if (p.shape === 'rect') {
            ctx.fillRect(-p.sizeW / 2, -p.sizeH / 2, p.sizeW, p.sizeH);
          } else if (p.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, p.sizeW / 2.3, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Sparkle / Diamond
            ctx.beginPath();
            const s = p.sizeW * 0.7;
            ctx.moveTo(0, -s);
            ctx.lineTo(s * 0.35, -s * 0.35);
            ctx.lineTo(s, 0);
            ctx.lineTo(s * 0.35, s * 0.35);
            ctx.lineTo(0, s);
            ctx.lineTo(-s * 0.35, s * 0.35);
            ctx.lineTo(-s, 0);
            ctx.lineTo(-s * 0.35, -s * 0.35);
            ctx.closePath();
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
