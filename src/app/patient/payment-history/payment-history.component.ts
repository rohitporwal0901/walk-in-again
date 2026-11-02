import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Transaction } from '../../core/models/transaction.model';
import { SessionService } from '../../core/services/session.service';
import { AuthService } from '../../core/services/auth.service';
import { Unsubscribe } from '@angular/fire/firestore';

@Component({
  selector: 'app-payment-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-history.component.html',
  styleUrl: './payment-history.component.scss'
})
export class PaymentHistoryComponent implements OnInit, OnDestroy {
  private sessionService = inject(SessionService);
  private auth = inject(AuthService);

  private txnUnsub: Unsubscribe | null = null;

  transactions = signal<Transaction[]>([]);
  isLoading = signal<boolean>(true);
  selectedTransaction = signal<Transaction | null>(null);

  ngOnInit() {
    const user = this.auth.currentUser();
    if (user?.uid) {
      this.txnUnsub = this.sessionService.listenToPatientTransactions(user.uid, (list) => {
        this.transactions.set(list);
        this.isLoading.set(false);
      });
    } else {
      this.isLoading.set(false);
    }
  }

  ngOnDestroy() {
    if (this.txnUnsub) {
      this.txnUnsub();
      this.txnUnsub = null;
    }
  }

  openDetail(txn: Transaction) {
    this.selectedTransaction.set(txn);
  }

  closeDetail() {
    this.selectedTransaction.set(null);
  }

  downloadReceipt(txn: Transaction) {
    window.print();
  }
}
