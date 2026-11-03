import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, onSnapshot, query, Unsubscribe } from '@angular/fire/firestore';
import { UserSubscription } from '../../core/models/subscription.model';

@Component({
  selector: 'app-admin-subscriptions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-subscriptions.component.html',
  styleUrl: './admin-subscriptions.component.scss'
})
export class AdminSubscriptionsComponent implements OnInit, OnDestroy {
  private firestore = inject(Firestore);
  private subUnsub: Unsubscribe | null = null;

  subscriptions = signal<UserSubscription[]>([]);
  isLoading = signal<boolean>(true);

  // Filters
  searchQuery = signal<string>('');
  selectedPlanFilter = signal<string>('All');
  selectedStatusFilter = signal<'All' | 'active' | 'expired'>('All');

  // Computed Metrics
  totalActiveCount = computed(() =>
    this.subscriptions().filter(s => s.status === 'active' && (s.remainingSessions ?? 0) > 0).length
  );

  totalMonthlyCount = computed(() =>
    this.subscriptions().filter(s =>
      s.status === 'active' &&
      (s.planName || '').toLowerCase().includes('month')
    ).length
  );

  total15DaysCount = computed(() =>
    this.subscriptions().filter(s =>
      s.status === 'active' &&
      ((s.planName || '').toLowerCase().includes('15') || (s.planName || '').toLowerCase().includes('biweekly'))
    ).length
  );

  totalSubRevenue = computed(() =>
    this.subscriptions()
      .filter(s => s.status === 'active' || s.status === 'expired')
      .reduce((sum, s) => sum + (Number(s.price) || 0), 0)
  );

  // Filtered List
  filteredSubscriptions = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const plan = this.selectedPlanFilter();
    const status = this.selectedStatusFilter();

    return this.subscriptions().filter(s => {
      // Search match
      const nameMatch = (s.patientName || '').toLowerCase().includes(q);
      const phoneMatch = (s.subscriptionId || '').toLowerCase().includes(q);
      const planMatchText = (s.planName || '').toLowerCase().includes(q);
      const matchesSearch = !q || nameMatch || phoneMatch || planMatchText;

      // Plan match
      let matchesPlan = true;
      if (plan !== 'All') {
        matchesPlan = (s.planName || '').toLowerCase().includes(plan.toLowerCase());
      }

      // Status match
      let matchesStatus = true;
      if (status !== 'All') {
        matchesStatus = s.status === status;
      }

      return matchesSearch && matchesPlan && matchesStatus;
    });
  });

  ngOnInit() {
    this.listenToSubscriptions();
  }

  ngOnDestroy() {
    this.subUnsub?.();
  }

  private listenToSubscriptions() {
    const subCol = collection(this.firestore, 'subscriptions');
    this.subUnsub = onSnapshot(subCol, snap => {
      const list: UserSubscription[] = [];
      snap.forEach(docSnap => {
        list.push({
          ...(docSnap.data() as UserSubscription),
          subscriptionId: docSnap.id
        });
      });

      // Sort newest first
      list.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.startDate || 0).getTime();
        const timeB = new Date(b.createdAt || b.startDate || 0).getTime();
        return timeB - timeA;
      });

      this.subscriptions.set(list);
      this.isLoading.set(false);
    }, err => {
      console.warn('Subscriptions listener error:', err);
      this.isLoading.set(false);
    });
  }

  getUsedSessions(sub: UserSubscription): number {
    return Math.max(0, (sub.totalSessions || 0) - (sub.remainingSessions ?? sub.totalSessions ?? 0));
  }

  getProgressPercent(sub: UserSubscription): number {
    if (!sub.totalSessions) return 0;
    const used = this.getUsedSessions(sub);
    return Math.min(100, Math.round((used / sub.totalSessions) * 100));
  }

  getRemainingDays(sub: UserSubscription): number | null {
    if (!sub.expiryDate) return null;
    try {
      const exp = new Date(sub.expiryDate).getTime();
      const now = new Date().getTime();
      const diff = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
      return Math.max(0, diff);
    } catch {
      return null;
    }
  }

  getPlanBadgeColor(planName?: string): { bg: string; text: string; border: string } {
    const p = (planName || '').toLowerCase();
    if (p.includes('month') || p.includes('30')) {
      return { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' };
    }
    if (p.includes('15') || p.includes('biweekly')) {
      return { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' };
    }
    return { bg: '#F1F5F9', text: '#334155', border: '#E2E8F0' };
  }
}
