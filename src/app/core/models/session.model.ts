export type SessionStatus = 'active' | 'completed' | 'pending' | 'cancelled';

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
  therapies: TherapyItem[];
  notes: string;
  fee: number;
  transactionId?: string;
  createdAt: any;
  updatedAt: any;
}

export const DEFAULT_THERAPIES: TherapyItem[] = [
  { id: 'therapy_exercise', label: 'Therapy Exercise', checked: false },
  { id: 'stretching', label: 'Stretching', checked: false },
  { id: 'heat_therapy', label: 'Heat Therapy', checked: false },
  { id: 'manual_therapy', label: 'Manual Therapy', checked: false },
  { id: 'electrical_stimulation', label: 'Electrical Stimulation', checked: false },
];
