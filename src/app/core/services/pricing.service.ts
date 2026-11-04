import { Injectable, inject, signal } from '@angular/core';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  Unsubscribe
} from '@angular/fire/firestore';

export interface ClinicPricingConfig {
  walkInFee: number;
  sessionDuration: number;
  notes?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_PRICING: ClinicPricingConfig = {
  walkInFee: 500,
  sessionDuration: 45,
  notes: 'Standard walk-in physiotherapy session rate'
};

@Injectable({ providedIn: 'root' })
export class PricingService {
  private firestore = inject(Firestore);

  // Reactive signals holding current pricing in sync with Firestore
  walkInFee = signal<number>(500);
  sessionDuration = signal<number>(45);
  pricingConfig = signal<ClinicPricingConfig>(DEFAULT_PRICING);
  isLoading = signal<boolean>(true);

  private unsub: Unsubscribe | null = null;

  constructor() {
    this.initRealtimeSync();
  }

  /** Real-time subscription to config/pricing document */
  private initRealtimeSync() {
    try {
      const ref = doc(this.firestore, 'config', 'pricing');
      this.unsub = onSnapshot(ref, (snap) => {
        this.isLoading.set(false);
        if (snap.exists()) {
          const data = snap.data() as ClinicPricingConfig;
          const fee = Number(data.walkInFee) || DEFAULT_PRICING.walkInFee;
          const duration = Number(data.sessionDuration) || DEFAULT_PRICING.sessionDuration;
          this.walkInFee.set(fee);
          this.sessionDuration.set(duration);
          this.pricingConfig.set({
            ...DEFAULT_PRICING,
            ...data,
            walkInFee: fee,
            sessionDuration: duration
          });
        } else {
          // If doc doesn't exist yet in Firestore, seed it once
          this.seedDefaultPricing();
        }
      }, (err) => {
        console.warn('Realtime pricing sync warning:', err);
        this.isLoading.set(false);
      });
    } catch (e) {
      console.warn('Could not setup pricing listener:', e);
      this.isLoading.set(false);
    }
  }

  /** Seed default pricing if document is missing in Firestore */
  async seedDefaultPricing(): Promise<void> {
    try {
      const ref = doc(this.firestore, 'config', 'pricing');
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          ...DEFAULT_PRICING,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn('Error seeding default pricing:', e);
    }
  }

  /** Async fetch walk-in fee directly from Firestore */
  async getWalkInFee(): Promise<number> {
    try {
      const ref = doc(this.firestore, 'config', 'pricing');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const val = Number(snap.data()['walkInFee']);
        if (!isNaN(val) && val > 0) {
          this.walkInFee.set(val);
          return val;
        }
      }
    } catch (e) {
      console.warn('Error fetching walkInFee:', e);
    }
    return this.walkInFee();
  }

  /** Save updated pricing to Firestore */
  async updatePricing(config: Partial<ClinicPricingConfig>): Promise<void> {
    const ref = doc(this.firestore, 'config', 'pricing');
    const updated = {
      walkInFee: Number(config.walkInFee) || this.walkInFee(),
      sessionDuration: Number(config.sessionDuration) || this.sessionDuration(),
      notes: config.notes || 'Updated via Admin Settings',
      updatedAt: new Date().toISOString()
    };
    await setDoc(ref, updated, { merge: true });
    this.walkInFee.set(updated.walkInFee);
    this.sessionDuration.set(updated.sessionDuration);
    this.pricingConfig.set({ ...this.pricingConfig(), ...updated });
  }
}
