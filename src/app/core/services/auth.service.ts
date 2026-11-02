import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  Unsubscribe
} from '@angular/fire/firestore';
import { User, UserRole } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);

  private profileUnsubscribe?: Unsubscribe;

  // Angular Signals
  currentUser = signal<User | null>(null);
  authLoading = signal<boolean>(true); // True while Firebase initializes auth state
  isLoading = signal<boolean>(false);
  authError = signal<string | null>(null);

  // Computed Signals
  isAuthenticated = computed(() => this.currentUser() !== null);
  userRole = computed(() => this.currentUser()?.role ?? null);
  userName = computed(() => this.currentUser()?.name ?? '');

  constructor() {
    this.initAuthStateListener();
  }

  /**
   * Listen to Firebase Auth state.
   * Session persists across refreshes and only terminates when signOut() is called.
   */
  private initAuthStateListener(): void {
    onAuthStateChanged(this.auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // Listen to live document updates from Firestore 'users' collection
        if (this.profileUnsubscribe) this.profileUnsubscribe();

        const userDocRef = doc(this.firestore, `users/${firebaseUser.uid}`);
        this.profileUnsubscribe = onSnapshot(
          userDocRef,
          (snap) => {
            if (snap.exists()) {
              const userData = snap.data() as User;
              this.currentUser.set(userData);
            }
            this.authLoading.set(false);
          },
          (err) => {
            console.error('Firestore profile stream error:', err);
            this.authLoading.set(false);
          }
        );
      } else {
        if (this.profileUnsubscribe) {
          this.profileUnsubscribe();
          this.profileUnsubscribe = undefined;
        }
        this.currentUser.set(null);
        this.authLoading.set(false);
      }
    });
  }

  // ─── Helpers: Phone to Email & 4-Digit M-PIN to Password ───────────────────
  phoneToEmail(phone: string): string {
    return `${phone.trim()}@walkinphysio.app`;
  }

  pinToPassword(pin: string): string {
    return `PIN#${pin.trim()}#SECURE`;
  }

  // ─── Check if phone is already registered in 'users' collection ────────────
  async isPhoneRegistered(phone: string): Promise<User | null> {
    try {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('mobileNumber', '==', phone.trim()));
      const snap = await getDocs(q);

      if (!snap.empty) {
        return snap.docs[0].data() as User;
      }
      return null;
    } catch (e) {
      console.error('Error checking phone registration:', e);
      return null;
    }
  }

  // ─── Login with 4-Digit M-PIN ──────────────────────────────────────────────
  async loginWithMpin(phone: string, pin: string): Promise<User> {
    this.authError.set(null);
    this.isLoading.set(true);

    try {
      const email = this.phoneToEmail(phone);
      const password = this.pinToPassword(pin);

      const userCred = await signInWithEmailAndPassword(this.auth, email, password);
      const uid = userCred.user.uid;

      // Fetch user profile from Firestore
      const userDoc = await getDoc(doc(this.firestore, `users/${uid}`));
      if (!userDoc.exists()) {
        throw new Error('User profile record not found in system.');
      }

      const userData = userDoc.data() as User;
      this.currentUser.set(userData);
      this.isLoading.set(false);

      this.navigateByRole(userData.role);
      return userData;
    } catch (err: any) {
      this.isLoading.set(false);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        throw new Error('Incorrect 4-digit M-PIN. Please try again.');
      } else if (err.code === 'auth/user-not-found') {
        throw new Error('Account not found. Please register as patient.');
      }
      throw new Error(err.message || 'Login failed. Please check credentials.');
    }
  }

  // ─── Patient Registration (Front se ONLY Patient account banega) ───────────
  async registerPatient(data: {
    name: string;
    phone: string;
    pin: string;
    age: number;
    gender: 'Male' | 'Female' | 'Other';
    condition: string;
  }): Promise<User> {
    this.authError.set(null);
    this.isLoading.set(true);

    try {
      const email = this.phoneToEmail(data.phone);
      const password = this.pinToPassword(data.pin);

      const userCred = await createUserWithEmailAndPassword(this.auth, email, password);
      const uid = userCred.user.uid;

      const newUser: User = {
        uid,
        mobileNumber: data.phone.trim(),
        name: data.name.trim(),
        role: 'patient', // Front se always patient
        pin: data.pin.trim(),
        age: data.age,
        gender: data.gender,
        condition: data.condition,
        totalSessions: 0,
        completedSessions: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save to 'users' collection
      await setDoc(doc(this.firestore, `users/${uid}`), newUser);

      this.currentUser.set(newUser);
      this.isLoading.set(false);

      this.navigateByRole('patient');
      return newUser;
    } catch (err: any) {
      this.isLoading.set(false);
      if (err.code === 'auth/email-already-in-use') {
        throw new Error('Mobile number is already registered. Please login.');
      }
      throw new Error(err.message || 'Registration failed. Please try again.');
    }
  }

  // ─── Worker Creation (Admin Panel se Worker Register hoga) ─────────────────
  async createWorkerFromAdmin(data: {
    name: string;
    phone: string;
    pin: string;
    specialization: string;
    experience: string;
  }): Promise<User> {
    const email = this.phoneToEmail(data.phone);
    const password = this.pinToPassword(data.pin);

    // Create Firebase Auth user
    const userCred = await createUserWithEmailAndPassword(this.auth, email, password);
    const uid = userCred.user.uid;

    const newWorker: User = {
      uid,
      mobileNumber: data.phone.trim(),
      name: data.name.trim(),
      role: 'worker',
      pin: data.pin.trim(),
      specialization: data.specialization.trim(),
      experience: data.experience.trim(),
      totalSessions: 0,
      completedSessions: 0,
      totalEarnings: 0,
      rating: 5.0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(this.firestore, `users/${uid}`), newWorker);
    return newWorker;
  }

  // ─── Navigate by Role ───────────────────────────────────────────────────────
  navigateByRole(role: UserRole): void {
    const routes: Record<UserRole, string> = {
      admin: '/admin/dashboard',
      worker: '/worker/dashboard',
      patient: '/patient/home'
    };
    this.router.navigate([routes[role]]);
  }

  // ─── Logout (Explicit user action) ──────────────────────────────────────────
  async logout(): Promise<void> {
    if (this.profileUnsubscribe) {
      this.profileUnsubscribe();
      this.profileUnsubscribe = undefined;
    }
    await signOut(this.auth);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  setLoading(loading: boolean): void {
    this.isLoading.set(loading);
  }

  setError(error: string | null): void {
    this.authError.set(error);
  }

  clearError(): void {
    this.authError.set(null);
  }
}
