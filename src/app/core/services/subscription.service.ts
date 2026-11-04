import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
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
        if (plans.length > 0) {
          return plans.sort((a, b) => a.order - b.order);
        }
      }
      // If config not set up yet, seed once
      await this.seedDefaultPlans();
      return this.getDefaultPlans();
    } catch (e) {
      console.error('Error fetching plans:', e);
      return this.getDefaultPlans();
    }
  }

  /** Seed default plans into Firestore config collection only if missing */
  async seedDefaultPlans(): Promise<void> {
    try {
      const ref = doc(this.firestore, 'config', 'subscription_plans');
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          plans: this.getDefaultPlans(),
          updatedAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn('Error seeding plans:', e);
    }
  }

  /** Force update plans in config (admin use) */
  async updatePlans(plans: SubscriptionPlan[]): Promise<void> {
    const ref = doc(this.firestore, 'config', 'subscription_plans');
    await setDoc(ref, {
      plans,
      updatedAt: new Date().toISOString()
    });
  }

  /** Watch subscription plans in real-time */
  watchPlans(cb: (plans: SubscriptionPlan[]) => void): Unsubscribe {
    const ref = doc(this.firestore, 'config', 'subscription_plans');
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const plans: SubscriptionPlan[] = data['plans'] || [];
        if (plans.length > 0) {
          cb(plans.sort((a, b) => a.order - b.order));
          return;
        }
      }
      cb(this.getDefaultPlans());
    }, (err) => {
      console.warn('watchPlans error:', err);
      cb(this.getDefaultPlans());
    });
  }

  /**
   * Fetch active subscription for a patient (checks remainingSessions > 0 and not expired)
   */
  async getActiveSubscription(patientId: string): Promise<UserSubscription | null> {
    try {
      const subRef = collection(this.firestore, 'subscriptions');
      const q = query(
        subRef,
        where('patientId', '==', patientId),
        where('status', '==', 'active')
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        for (const docSnap of snap.docs) {
          const sub = docSnap.data() as UserSubscription;
          // Verify remaining sessions: Plan stays active until sessions reach 0
          if ((sub.remainingSessions ?? 0) > 0) {
            return { ...sub, subscriptionId: docSnap.id };
          } else {
            // No sessions left -> mark expired
            await updateDoc(doc(this.firestore, 'subscriptions', docSnap.id), {
              status: 'expired',
              updatedAt: new Date().toISOString()
            });
          }
        }
      }
      return null;
    } catch (e) {
      console.warn('Error checking active subscription:', e);
      return null;
    }
  }

  /** Buy a subscription plan for a patient (Generates standard Firestore Doc IDs) */
  async purchaseSubscription(data: {
    patientId: string;
    patientName: string;
    plan: SubscriptionPlan;
    paymentMethod: 'UPI' | 'Card' | 'Cash';
    razorpayPaymentId?: string;
  }): Promise<string> {
    // 1. Standard Firestore Auto-Generated Document ID
    const subRef = doc(collection(this.firestore, 'subscriptions'));
    const subscriptionId = subRef.id;

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
    await setDoc(subRef, newSub);

    // 2. Standard Firestore Auto-Generated Transaction Document ID
    const txnRef = doc(collection(this.firestore, 'transactions'));
    const txnId = txnRef.id;

    await setDoc(txnRef, {
      transactionId: txnId,
      sessionId: subscriptionId,
      patientId: data.patientId,
      patientName: data.patientName,
      patientMobile: '',
      workerId: 'clinic_admin',
      workerName: 'Walk In Physio Clinic',
      workerMobile: '',
      amount: data.plan.price,
      paymentMethod: data.paymentMethod,
      razorpayPaymentId: data.razorpayPaymentId || '',
      status: 'Paid',
      sessionDate: now.toISOString(),
      sessionTimeSlot: `${data.plan.name} Plan (${data.plan.sessions} Sessions)`,
      sessionDuration: data.plan.durationDays,
      timestamp: now.toISOString(),
      planName: data.plan.name,
      description: `${data.plan.name} Plan (${data.plan.sessions} Sessions)`,
      type: 'subscription'
    });

    // 3. Update user profile with subscription info
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

  /**
   * Decrement patient's remaining sessions after a session completes.
   * Decrements in BOTH 'subscriptions' collection AND 'users' collection.
   * If remainingSessions reaches 0, automatically marks the subscription as 'expired'!
   */
  async decrementSession(patientId: string): Promise<{ remainingSessions: number; isExpired: boolean }> {
    try {
      let newRemaining = 0;
      let isExpired = false;

      // 1. Decrement in 'subscriptions' collection
      const subRef = collection(this.firestore, 'subscriptions');
      const q = query(subRef, where('patientId', '==', patientId), where('status', '==', 'active'));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const subDoc = snap.docs[0];
        const subData = subDoc.data() as UserSubscription;
        newRemaining = Math.max(0, (subData.remainingSessions ?? 1) - 1);
        isExpired = newRemaining <= 0;

        await updateDoc(doc(this.firestore, 'subscriptions', subDoc.id), {
          remainingSessions: newRemaining,
          status: isExpired ? 'expired' : 'active',
          updatedAt: new Date().toISOString()
        });
      }

      // 2. Decrement in 'users' collection
      const userRef = doc(this.firestore, 'users', patientId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (snap.empty) {
          newRemaining = Math.max(0, (userData['remainingSessions'] ?? 1) - 1);
          isExpired = newRemaining <= 0;
        }

        await updateDoc(userRef, {
          remainingSessions: newRemaining,
          subscriptionStatus: isExpired ? 'expired' : 'active',
          updatedAt: new Date().toISOString()
        });
      }

      return { remainingSessions: newRemaining, isExpired };
    } catch (e) {
      console.warn('Could not decrement sessions:', e);
      return { remainingSessions: 0, isExpired: false };
    }
  }

  /** Watch patient's active subscription in real-time */
  watchPatientSubscription(patientId: string, cb: (sub: UserSubscription | null) => void): Unsubscribe {
    const subRef = collection(this.firestore, 'subscriptions');
    const q = query(subRef, where('patientId', '==', patientId), where('status', '==', 'active'));
    return onSnapshot(q, snap => {
      if (snap.empty) {
        cb(null);
        return;
      }
      const sub = snap.docs[0].data() as UserSubscription;
      // If remaining sessions is 0, auto-expire
      if ((sub.remainingSessions ?? 0) <= 0) {
        updateDoc(doc(this.firestore, 'subscriptions', snap.docs[0].id), {
          status: 'expired',
          updatedAt: new Date().toISOString()
        }).catch(() => {});
        cb(null);
        return;
      }
      cb({ ...sub, subscriptionId: snap.docs[0].id });
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
