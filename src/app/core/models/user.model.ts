export type UserRole = 'worker' | 'patient' | 'admin';

export interface User {
  uid: string;
  userId?: string; // compatibility alias for uid
  mobileNumber: string;
  name: string;
  role: UserRole;
  pin?: string;
  // Patient details
  age?: number;
  gender?: 'Male' | 'Female' | 'Other';
  condition?: string; // Primary area of pain
  problemArea?: string; // Alias for condition
  totalSessions?: number;
  completedSessions?: number;
  // Worker details
  specialization?: string;
  experience?: string;
  totalEarnings?: number;
  rating?: number;
  // Metadata
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Subscription
  subscriptionPlanId?: string;      // e.g. 'plan_daily', 'plan_weekly', 'plan_monthly'
  subscriptionPlanName?: string;    // e.g. 'Daily', 'Weekly', 'Monthly'
  remainingSessions?: number;       // sessions left in current plan
  subscriptionExpiry?: string;      // ISO date
  subscriptionStatus?: 'active' | 'expired' | 'none';
}

export type PatientProfile = User;
export type WorkerProfile = User;
