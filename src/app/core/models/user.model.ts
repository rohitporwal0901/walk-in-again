export type UserRole = 'worker' | 'patient' | 'admin';

export interface User {
  mobileNumber: string;
  mpinHash: string;
  role: UserRole;
  name: string;
  email?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkerProfile {
  userId: string;
  mobileNumber: string;
  name: string;
  specialization: string;
  experience: string; // e.g. "5 Years Exp."
  avatarUrl?: string;
  totalSessions: number;
  completedSessions: number;
  totalEarnings: number;
  rating?: number;
}

export interface PatientProfile {
  userId: string;
  mobileNumber: string;
  name: string;
  email?: string;
  address?: string;
  avatarUrl?: string;
  totalSessions: number;
  completedSessions: number;
  condition?: string; // e.g. "Knee Pain", "Back Pain"
}
