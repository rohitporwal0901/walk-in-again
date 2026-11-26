import { Injectable } from '@angular/core';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AvatarService {
  // Real Indian Physiotherapist / Doctor Avatars
  private readonly physioMaleAvatars = [
    'assets/images/avatars/physio-male-1.jpg',
    'assets/images/avatars/physio-male-2.jpg'
  ];

  private readonly physioFemaleAvatars = [
    'assets/images/avatars/physio-female-1.jpg',
    'assets/images/avatars/physio-female-2.jpg'
  ];

  // Real Indian Patient Avatars
  private readonly patientMaleAvatars = [
    'assets/images/avatars/patient-male-1.jpg',
    'assets/images/avatars/patient-male-2.jpg',
    'assets/images/avatars/patient-male-3.jpg'
  ];

  private readonly patientFemaleAvatars = [
    'assets/images/avatars/patient-female-1.jpg',
    'assets/images/avatars/patient-female-2.jpg'
  ];

  private readonly femaleKeywords = [
    'priya', 'ananya', 'pooja', 'neha', 'sunita', 'kavita', 'anita',
    'sneha', 'sharma', 'devi', 'patel', 'mehta', 'dr. priya', 'dr. ananya',
    'mrs', 'ms', 'miss', 'dr priya', 'dr ananya'
  ];

  /**
   * Deterministically calculates a positive integer hash from any string
   */
  private getHash(str: string): number {
    let hash = 0;
    if (!str || str.length === 0) return 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Checks if a name looks like a female name
   */
  private isLikelyFemale(name: string, gender?: string): boolean {
    if (gender) {
      return gender.trim().toLowerCase() === 'female';
    }
    if (!name) return false;
    const lower = name.toLowerCase();
    return this.femaleKeywords.some(keyword => lower.includes(keyword));
  }

  /**
   * Returns uploaded user photo if present, otherwise returns a photorealistic Indian doctor avatar
   */
  getWorkerAvatar(nameOrId: string = 'Doctor', gender?: string, customAvatarUrl?: string): string {
    if (customAvatarUrl && customAvatarUrl.trim().length > 0) {
      return customAvatarUrl;
    }
    const isFemale = this.isLikelyFemale(nameOrId, gender);
    const pool = isFemale ? this.physioFemaleAvatars : this.physioMaleAvatars;
    const hash = this.getHash(nameOrId);
    return pool[hash % pool.length];
  }

  /**
   * Returns uploaded user photo if present, otherwise returns a photorealistic Indian patient avatar
   */
  getPatientAvatar(nameOrId: string = 'Patient', gender?: string, customAvatarUrl?: string): string {
    if (customAvatarUrl && customAvatarUrl.trim().length > 0) {
      return customAvatarUrl;
    }
    if (gender) {
      const isFemale = gender.trim().toLowerCase() === 'female';
      const pool = isFemale ? this.patientFemaleAvatars : this.patientMaleAvatars;
      const hash = this.getHash(nameOrId);
      return pool[hash % pool.length];
    }

    const isFemale = this.isLikelyFemale(nameOrId);
    const pool = isFemale ? this.patientFemaleAvatars : this.patientMaleAvatars;
    const hash = this.getHash(nameOrId);
    return pool[hash % pool.length];
  }

  /**
   * Universal avatar getter for any role, prioritizing custom uploaded photo
   */
  getAvatar(nameOrId: string = 'User', role: string = 'patient', gender?: string, customAvatarUrl?: string): string {
    if (customAvatarUrl && customAvatarUrl.trim().length > 0) {
      return customAvatarUrl;
    }
    if (role === 'worker' || role === 'therapist' || role === 'doctor' || role === 'admin') {
      return this.getWorkerAvatar(nameOrId, gender, customAvatarUrl);
    }
    return this.getPatientAvatar(nameOrId, gender, customAvatarUrl);
  }

  /**
   * Direct User object avatar helper: returns custom photo if uploaded, otherwise fallback Indian avatar
   */
  getUserAvatar(user?: Partial<User> | null): string {
    if (!user) {
      return this.getPatientAvatar();
    }
    if (user.avatarUrl && user.avatarUrl.trim().length > 0) {
      return user.avatarUrl;
    }
    return this.getAvatar(user.name, user.role, user.gender);
  }

  /**
   * Converts and compresses a selected image file to an optimized Base64 JPEG data URL (< 80KB)
   */
  compressAndConvertToBase64(file: File, maxDimension = 360, quality = 0.82): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please select an image file (JPG, PNG, WebP).'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const size = Math.min(img.width, img.height);
            const startX = (img.width - size) / 2;
            const startY = (img.height - size) / 2;

            const targetSize = Math.min(size, maxDimension);
            canvas.width = targetSize;
            canvas.height = targetSize;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(e.target?.result as string);
              return;
            }

            // High-quality downsampling & center crop
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, startX, startY, size, size, 0, 0, targetSize, targetSize);

            const base64DataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(base64DataUrl);
          } catch (err) {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image file.'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
  }
}
