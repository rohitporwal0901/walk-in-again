export type SessionStatus = 'pending_otp' | 'active' | 'completed' | 'pending' | 'cancelled';

export interface TherapyItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface Session {
  sessionId: string;
  patientId: string;
  patientName: string;
  patientMobile?: string;
  workerId: string;
  workerName: string;
  workerMobile?: string;
  date: any;
  timeSlot: string;         // e.g. "10:00 AM - 10:30 AM"
  duration: number;         // in minutes
  status: SessionStatus;
  otp?: string;             // 4-digit verification code
  startedAt?: any;          // Timestamp when OTP verified & timer started
  endedAt?: any;            // Timestamp when session ended
  paymentStatus?: 'pending' | 'paid';
  isCoveredBySubscription?: boolean;
  planName?: string;
  therapies: TherapyItem[];
  notes: string;
  fee: number;
  sessionValue?: number;    // Earning value of the session for worker (e.g. ₹500 or plan per-session rate)
  transactionId?: string;
  createdAt: any;
  updatedAt: any;
}

export const DEFAULT_THERAPIES: TherapyItem[] = [
  { id: 'therapy_exercise', label: 'Therapy Trackers', checked: true },
  { id: 'stretching', label: 'Stretching', checked: false },
  { id: 'heat_therapy', label: 'Heat Therapy & Massage', checked: false },
  { id: 'joint_mobilization', label: 'Joint Mobilization', checked: false },
  { id: 'electrical_stimulation', label: 'Electrical Stimulation', checked: false },
];

/**
 * Calculate the earning value of a session for the worker according to the plan rate:
 * - Monthly Plan (₹10,000 / 30 sessions) = ₹333 per session
 * - 15 Days Plan (₹6,000 / 15 sessions)  = ₹400 per session
 * - Weekly Plan (₹3,000 / 7 sessions)    = ₹429 per session
 * - Regular Walk-In Session              = Actual Fee (or default ₹500)
 */
export function calculateSessionEarning(session: {
  fee?: number;
  sessionValue?: number;
  isCoveredBySubscription?: boolean;
  planName?: string;
}): number {
  if (session.sessionValue && session.sessionValue > 0) {
    return session.sessionValue;
  }

  if (session.isCoveredBySubscription || session.planName) {
    const p = (session.planName || '').toLowerCase();
    if (p.includes('month') || p.includes('30')) {
      return Math.round(10000 / 30); // ₹333
    }
    if (p.includes('15') || p.includes('biweekly') || p.includes('bi-weekly')) {
      return Math.round(6000 / 15); // ₹400
    }
    if (p.includes('week') || p.includes('7')) {
      return Math.round(3000 / 7); // ₹429
    }
    return Math.round(10000 / 30); // Fallback: ₹333
  }

  return Number(session.fee) || 500;
}

