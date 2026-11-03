export type PaymentStatus = 'Paid' | 'Pending' | 'Failed' | 'Refunded';
export type PaymentMethod = 'UPI' | 'Card' | 'Cash' | 'NetBanking' | 'Subscription';

export interface Transaction {
  transactionId: string;
  sessionId?: string;
  patientId: string;
  patientName: string;
  patientMobile?: string;
  patientEmail?: string;
  patientAddress?: string;
  workerId?: string;
  workerName?: string;
  workerMobile?: string;
  workerSpecialization?: string;
  workerExperience?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  status: PaymentStatus;
  sessionDate?: any;
  sessionTimeSlot?: string;
  sessionDuration?: number;
  receiptUrl?: string;
  timestamp: any;
  planName?: string;
  description?: string;
  type?: 'session' | 'subscription';
}

export interface PaymentBreakdown {
  method: PaymentMethod;
  percentage: number;
  amount: number;
  color: string;
}
