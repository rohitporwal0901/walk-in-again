export interface SubscriptionPlan {
  id: string;           // e.g. 'plan_daily'
  name: string;         // 'Daily', 'Weekly', 'Monthly'
  sessions: number;     // 1, 7, 30
  price: number;        // 500, 3000, 10000
  durationDays: number; // 1, 7, 30
  description: string;
  features: string[];
  isPopular?: boolean;
  color: string;        // accent color for card
  icon: string;         // emoji icon
  order: number;        // display sort order
}

export interface UserSubscription {
  subscriptionId: string;
  patientId: string;
  patientName: string;
  planId: string;
  planName: string;
  totalSessions: number;
  remainingSessions: number;
  price: number;
  paymentMethod: 'UPI' | 'Card' | 'Cash';
  razorpayPaymentId?: string;
  status: 'active' | 'expired' | 'cancelled';
  startDate: string;
  expiryDate: string;
  createdAt: string;
  updatedAt: string;
}
