import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  Unsubscribe
} from '@angular/fire/firestore';
import { SubscriptionPlan, UserSubscription } from '../models/subscription.model';

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private firestore = inject(Firestore);

  /** Fetch subscription plans from Firestore config collection */
  async getPlans(): Promise<SubscriptionPlan[]> {
    try {
      const planDoc = await getDoc(doc(this.firestore, 'config', 'subscription_plans'));
      if (planDoc.exists()) {
        const data = planDoc.data();
        const plans: SubscriptionPlan[] = data['plans'] || [];
        return plans.sort((a, b) => a.order - b.order);
      }
      // Fallback defaults if config not set up yet
      return this.getDefaultPlans();
    } catch (e) {
      console.error('Error fetching plans:', e);
      return this.getDefaultPlans();
    }
  }

  /** Seed default plans into Firestore config collection.
   *  Always overwrites to keep plans in sync with code defaults. */
  async seedDefaultPlans(): Promise<void> {
    const ref = doc(this.firestore, 'config', 'subscription_plans');
    await setDoc(ref, {
      plans: this.getDefaultPlans(),
      updatedAt: new Date().toISOString()
    });
  }

  /** Force update plans in config (admin use) */
  async updatePlans(plans: SubscriptionPlan[]): Promise<void> {
    const ref = doc(this.firestore, 'config', 'subscription_plans');
    await setDoc(ref, {
      plans,
      updatedAt: new Date().toISOString()
    });
  }

  /** Buy a subscription plan for a patient */
  async purchaseSubscription(data: {
    patientId: string;
    patientName: string;
    plan: SubscriptionPlan;
    paymentMethod: 'UPI' | 'Card' | 'Cash';
    razorpayPaymentId?: string;
  }): Promise<string> {
    const subscriptionId = `sub_${Date.now()}`;
    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setDate(expiryDate.getDate() + data.plan.durationDays);

    const newSub: UserSubscription = {
      subscriptionId,
      patientId: data.patientId,
      patientName: data.patientName,
      planId: data.plan.id,
      planName: data.plan.name,
      totalSessions: data.plan.sessions,
      remainingSessions: data.plan.sessions,
      price: data.plan.price,
      paymentMethod: data.paymentMethod,
      razorpayPaymentId: data.razorpayPaymentId || '',
      status: 'active',
      startDate: now.toISOString(),
      expiryDate: expiryDate.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    // Save to subscriptions collection
    await setDoc(doc(this.firestore, 'subscriptions', subscriptionId), newSub);

    // Update user profile with subscription info
    await updateDoc(doc(this.firestore, 'users', data.patientId), {
      subscriptionPlanId: data.plan.id,
      subscriptionPlanName: data.plan.name,
      remainingSessions: data.plan.sessions,
      subscriptionExpiry: expiryDate.toISOString(),
      subscriptionStatus: 'active',
      updatedAt: now.toISOString()
    });

    return subscriptionId;
  }

  /** Decrement patient's remaining sessions after a session completes */
  async decrementSession(patientId: string): Promise<void> {
    try {
      const userRef = doc(this.firestore, 'users', patientId);
      const snap = await getDoc(userRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const remaining = (data['remainingSessions'] || 0) - 1;
      await updateDoc(userRef, {
        remainingSessions: Math.max(0, remaining),
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Could not decrement sessions:', e);
    }
  }

  /** Watch patient's active subscription */
  watchPatientSubscription(patientId: string, cb: (sub: UserSubscription | null) => void): Unsubscribe {
    const subRef = collection(this.firestore, 'subscriptions');
    const q = query(subRef, where('patientId', '==', patientId), where('status', '==', 'active'));
    return onSnapshot(q, snap => {
      if (snap.empty) { cb(null); return; }
      cb(snap.docs[0].data() as UserSubscription);
    });
  }

  getDefaultPlans(): SubscriptionPlan[] {
    return [
      {
        id: 'plan_weekly',
        name: 'Weekly',
        sessions: 7,
        price: 3000,
        durationDays: 7,
        description: 'Best for short-term recovery — 7 sessions in 7 days',
        features: [
          '7 Therapy Sessions',
          'Progress Tracking',
          'Personalised Exercise Plan',
          'Priority Booking',
          'Session Receipts'
        ],
        isPopular: false,
        color: '#2196F3',
        icon: '📅',
        order: 1
      },
      {
        id: 'plan_biweekly',
        name: '15 Days',
        sessions: 15,
        price: 6000,
        durationDays: 15,
        description: 'Ideal for moderate treatment — 15 sessions over 2 weeks',
        features: [
          '15 Therapy Sessions',
          'Progress Tracking',
          'Custom Exercise Plan',
          'Priority Booking',
          'Detailed Progress Report',
          'All Receipts'
        ],
        isPopular: true,
        color: '#1CB5E0',
        icon: '⭐',
        order: 2
      },
      {
        id: 'plan_monthly',
        name: 'Monthly',
        sessions: 30,
        price: 10000,
        durationDays: 30,
        description: 'Complete treatment course — 30 sessions over a month',
        features: [
          '30 Therapy Sessions',
          'Full Progress Reports',
          'Custom Exercise Plan',
          'Priority Booking',
          'Free Consultation',
          'WhatsApp Receipts',
          'All Receipts'
        ],
        isPopular: false,
        color: '#F4A62A',
        icon: '🏆',
        order: 3
      }
    ];
  }
}
