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
