import { Injectable } from '@angular/core';
import { Transaction, PaymentMethod } from '../models/transaction.model';
import { FirestoreService } from './firestore.service';
import { environment } from '../../../environments/environment';
import { Firestore, collection, doc } from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';

declare var Razorpay: any;

export interface RazorpayOptions {
  key: string;
  amount: number; // in paise
  currency: string;
  name: string;
  description: string;
  order_id?: string;
  prefill: {
    name: string;
    email?: string;
    contact: string;
  };
  theme: { color: string };
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss: () => void };
}

export interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  constructor(
    private firestoreService: FirestoreService,
    private firestore: Firestore
  ) {}

  /** Load Razorpay script dynamically */
  loadRazorpayScript(): Promise<boolean> {
    return new Promise(resolve => {
      if (typeof Razorpay !== 'undefined') { resolve(true); return; }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  /** Open Razorpay payment modal */
  async openPayment(options: {
    amount: number;
    patientName: string;
    patientMobile: string;
    patientEmail?: string;
    description: string;
  }): Promise<RazorpayResponse> {
    await this.loadRazorpayScript();
    return new Promise((resolve, reject) => {
      const rzpOptions: RazorpayOptions = {
        key: environment.razorpay.keyId,
        amount: options.amount * 100, // convert to paise
        currency: 'INR',
        name: 'Walk In Again Physiotherapy',
        description: options.description,
        prefill: {
          name: options.patientName,
          contact: options.patientMobile,
          email: options.patientEmail
        },
        theme: { color: '#0B2545' },
        handler: (response: RazorpayResponse) => resolve(response),
        modal: { ondismiss: () => reject(new Error('Payment cancelled')) }
      };
      const rzp = new Razorpay(rzpOptions);
      rzp.open();
    });
  }

  /** Save transaction to Firestore */
  saveTransaction(transaction: Omit<Transaction, 'transactionId'>): Observable<void> {
    const docRef = doc(collection(this.firestore, 'transactions'));
    const id = docRef.id;
    return this.firestoreService.setDoc<Transaction>(
      'transactions',
      id,
      { ...transaction, transactionId: id } as any
    );
  }

  /** Fetch transactions for a patient */
  getPatientTransactions(patientId: string): Observable<Transaction[]> {
    return this.firestoreService.watchCollection<Transaction>(
      'transactions',
      this.firestoreService.where('patientId', '==', patientId),
      this.firestoreService.orderBy('timestamp', 'desc')
    );
  }

  /** Fetch all transactions (admin) */
  getAllTransactions(limitCount = 50): Observable<Transaction[]> {
    return this.firestoreService.watchCollection<Transaction>(
      'transactions',
      this.firestoreService.orderBy('timestamp', 'desc'),
      this.firestoreService.limit(limitCount)
    );
  }

  formatCurrency(amount: number): string {
    return `₹${amount.toLocaleString('en-IN')}`;
  }
}
