import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Transaction } from '../../core/models/transaction.model';

@Component({
  selector: 'app-payment-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-history.component.html',
  styleUrl: './payment-history.component.scss'
})
export class PaymentHistoryComponent {
  transactions = signal<Transaction[]>([
    { transactionId: 'txn_1234567890', sessionId: 's1', patientId: 'p1', patientName: 'Priya Mehta',
      patientMobile: '9123456789', workerId: 'w1', workerName: 'Rahul Sharma', workerMobile: '9876543210',
      amount: 500, paymentMethod: 'UPI', razorpayPaymentId: 'pay_1234567890', status: 'Paid',
      sessionDate: new Date('2026-10-26'), sessionTimeSlot: '10:00 AM - 10:30 AM', sessionDuration: 30,
      timestamp: new Date('2026-10-26T11:15:00') },
    { transactionId: 'txn_0987654321', sessionId: 's2', patientId: 'p1', patientName: 'Priya Mehta',
      patientMobile: '9123456789', workerId: 'w2', workerName: 'Neha Gupta', workerMobile: '9876543211',
      amount: 500, paymentMethod: 'Card', status: 'Paid',
      sessionDate: new Date('2026-10-24'), sessionTimeSlot: '11:00 AM - 11:30 AM', sessionDuration: 30,
      timestamp: new Date('2026-10-24T11:35:00') },
    { transactionId: 'txn_1122334455', sessionId: 's3', patientId: 'p1', patientName: 'Priya Mehta',
      patientMobile: '9123456789', workerId: 'w3', workerName: 'Amit Verma', workerMobile: '9876543212',
      amount: 500, paymentMethod: 'Cash', status: 'Pending',
      sessionDate: new Date('2026-10-22'), sessionTimeSlot: '09:00 AM - 09:30 AM', sessionDuration: 30,
      timestamp: new Date('2026-10-22T09:35:00') },
  ]);

  selectedTransaction = signal<Transaction | null>(null);

  openDetail(txn: Transaction) { this.selectedTransaction.set(txn); }
  closeDetail() { this.selectedTransaction.set(null); }

  downloadReceipt(txn: Transaction) {
    // In production: download from Firebase Storage
    alert(`Downloading receipt for ${txn.transactionId}`);
  }
}
