import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { Transaction } from '../../core/models/transaction.model';
import { SessionService } from '../../core/services/session.service';
import { SubscriptionService } from '../../core/services/subscription.service';
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
  private subscriptionService = inject(SubscriptionService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private location = inject(Location);

  private txnUnsub: Unsubscribe | null = null;
  private subUnsub: Unsubscribe | null = null;
  private loadTimeout: any = null;

  transactions = signal<Transaction[]>([]);
  isLoading = signal<boolean>(true);
  selectedTransaction = signal<Transaction | null>(null);

  totalAmountPaid = computed(() => {
    return this.transactions()
      .filter(t => String(t.status || '').toLowerCase() === 'paid' && !this.isSubscriptionMethod(t.paymentMethod))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  });

  paidTransactionsCount = computed(() => {
    return this.transactions()
      .filter(t => String(t.status || '').toLowerCase() === 'paid' && !this.isSubscriptionMethod(t.paymentMethod))
      .length;
  });

  coveredSessionsCount = computed(() => {
    return this.transactions()
      .filter(t => this.isSubscriptionMethod(t.paymentMethod))
      .length;
  });

  totalSavedAmount = computed(() => {
    return this.transactions()
      .filter(t => this.isSubscriptionMethod(t.paymentMethod))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  });

  private rawTxns: Transaction[] = [];
  private currentSubTxn: Transaction | null = null;

  isSubscriptionMethod(method?: string): boolean {
    return (method || '').trim().toLowerCase() === 'subscription';
  }

  private updateCombinedList() {
    const list = [...this.rawTxns];

    if (this.currentSubTxn) {
      const hasSubTxn = list.some(t =>
        t.transactionId === this.currentSubTxn?.transactionId ||
        t.sessionId === this.currentSubTxn?.sessionId ||
        (t.type === 'subscription' && t.planName === this.currentSubTxn?.planName)
      );
      if (!hasSubTxn) {
        list.unshift(this.currentSubTxn);
      }
    }

    list.sort((a, b) => new Date(b.timestamp || b.sessionDate || 0).getTime() - new Date(a.timestamp || a.sessionDate || 0).getTime());
    this.transactions.set(list);
  }

  ngOnInit() {
    const user = this.auth.currentUser();
    if (user?.uid) {
      // Listen to transactions
      this.txnUnsub = this.sessionService.listenToPatientTransactions(user.uid, (list) => {
        this.rawTxns = list;
        this.updateCombinedList();
        this.isLoading.set(false);
      });

      // Also watch subscription in case an existing subscription purchase was made
      this.subUnsub = this.subscriptionService.watchPatientSubscription(user.uid, (sub) => {
        if (sub && sub.price) {
          this.currentSubTxn = {
            transactionId: sub.subscriptionId,
            sessionId: sub.subscriptionId,
            patientId: sub.patientId,
            patientName: sub.patientName,
            amount: sub.price,
            paymentMethod: (sub.paymentMethod as any) || 'UPI',
            status: 'Paid',
            timestamp: sub.createdAt || sub.startDate,
            sessionDate: sub.createdAt || sub.startDate,
            planName: sub.planName,
            description: `${sub.planName} Plan (${sub.totalSessions} Sessions)`,
            type: 'subscription'
          };
          this.updateCombinedList();
        }
      });

      this.loadTimeout = setTimeout(() => {
        this.isLoading.set(false);
      }, 1200);
    } else {
      this.isLoading.set(false);
    }
  }

  ngOnDestroy() {
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
    }
    if (this.txnUnsub) {
      this.txnUnsub();
      this.txnUnsub = null;
    }
    if (this.subUnsub) {
      this.subUnsub();
      this.subUnsub = null;
    }
  }

  getTransactionSubtitle(txn: Transaction): string {
    if (txn.description) {
      return txn.description;
    }
    if (txn.planName) {
      return `${txn.planName} Plan`;
    }
    if (txn.sessionId) {
      const cleanId = txn.sessionId.replace(/^sess_|^sub_/, '');
      return `Session #${cleanId.slice(-6)}`;
    }
    return 'Physiotherapy Visit';
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

  downloadLatestReceipt() {
    const list = this.transactions();
    if (list.length > 0) {
      this.openDetail(list[0]);
    } else {
      window.print();
    }
  }

  goBack() {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/patient/home']);
    }
  }
}
