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
  selectedStatusFilter = signal<'All' | 'active' | 'expired' | 'cancelled'>('All');
  selectedDateFilter = signal<string>('All');
  customStartDate = signal<string>('');
  customEndDate = signal<string>('');

  // Pagination
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);

  // Date-filtered base list for KPIs and table
  dateFilteredSubscriptions = computed(() => {
    let list = this.subscriptions();
    const dateFilter = this.selectedDateFilter();

    if (dateFilter !== 'All') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const endOfToday = startOfToday + 86400000 - 1;

      if (dateFilter === 'today') {
        list = list.filter(s => {
          const raw = new Date(s.createdAt || s.startDate || 0).getTime();
          return raw >= startOfToday && raw <= endOfToday;
        });
      } else if (dateFilter === 'yesterday') {
        const startOfYesterday = startOfToday - 86400000;
        list = list.filter(s => {
          const raw = new Date(s.createdAt || s.startDate || 0).getTime();
          return raw >= startOfYesterday && raw < startOfToday;
        });
      } else if (dateFilter === 'week') {
        const weekAgo = now.getTime() - 7 * 86400000;
        list = list.filter(s => {
          const raw = new Date(s.createdAt || s.startDate || 0).getTime();
          return raw >= weekAgo;
        });
      } else if (dateFilter === 'month') {
        const monthAgo = now.getTime() - 30 * 86400000;
        list = list.filter(s => {
          const raw = new Date(s.createdAt || s.startDate || 0).getTime();
          return raw >= monthAgo;
        });
      } else if (dateFilter === 'custom') {
        const start = this.customStartDate() ? new Date(this.customStartDate()).setHours(0, 0, 0, 0) : 0;
        const end = this.customEndDate() ? new Date(this.customEndDate()).setHours(23, 59, 59, 999) : Infinity;
        list = list.filter(s => {
          const raw = new Date(s.createdAt || s.startDate || 0).getTime();
          return raw >= start && raw <= end;
        });
      }
    }

    return list;
  });

  // Computed Metrics dynamically based on dateFilteredSubscriptions()!
  totalActiveCount = computed(() =>
    this.dateFilteredSubscriptions().filter(s => s.status === 'active' && s.remainingSessions > 0).length
  );

  totalMonthlyCount = computed(() =>
    this.dateFilteredSubscriptions().filter(s =>
      s.status === 'active' &&
      ((s.planName || '').toLowerCase().includes('month') || (s.planName || '').toLowerCase().includes('30'))
    ).length
  );

  total15DaysCount = computed(() =>
    this.dateFilteredSubscriptions().filter(s =>
      s.status === 'active' &&
      ((s.planName || '').toLowerCase().includes('15') || (s.planName || '').toLowerCase().includes('biweekly'))
    ).length
  );

  totalSubRevenue = computed(() =>
    this.dateFilteredSubscriptions().reduce((sum, s) => sum + (Number(s.price) || 0), 0)
  );

  // Filtered List
  filteredSubscriptions = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const plan = this.selectedPlanFilter();
    const status = this.selectedStatusFilter();

    return this.dateFilteredSubscriptions().filter(s => {
      // Search match
      const nameMatch = (s.patientName || '').toLowerCase().includes(q);
      const phoneMatch = (s.subscriptionId || '').toLowerCase().includes(q);
      const planMatchText = (s.planName || '').toLowerCase().includes(q);
      const matchesSearch = !q || nameMatch || phoneMatch || planMatchText;

      // Plan match
      let matchesPlan = true;
      if (plan !== 'All') {
        const p = (s.planName || '').toLowerCase();
        if (plan === 'Monthly') {
          matchesPlan = p.includes('month') || p.includes('30');
        } else if (plan === '15 Days') {
          matchesPlan = p.includes('15') || p.includes('biweekly');
        } else if (plan === 'Weekly') {
          matchesPlan = p.includes('week') || p.includes('7');
        } else {
          matchesPlan = p.includes(plan.toLowerCase());
        }
      }

      // Status match
      let matchesStatus = true;
      if (status !== 'All') {
        if (status === 'active') {
          matchesStatus = s.status === 'active' && s.remainingSessions > 0;
        } else if (status === 'cancelled') {
          matchesStatus = s.status === 'cancelled';
        } else if (status === 'expired') {
          matchesStatus = s.status === 'expired' || (s.status === 'active' && s.remainingSessions <= 0);
        }
      }

      return matchesSearch && matchesPlan && matchesStatus;
    });
  });

  // Pagination Computations
  totalPages = computed(() => {
    const pages = Math.ceil(this.filteredSubscriptions().length / this.pageSize());
    return pages > 0 ? pages : 1;
  });

  paginatedSubscriptions = computed(() => {
    const list = this.filteredSubscriptions();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  startIndex = computed(() => {
    const len = this.filteredSubscriptions().length;
    if (len === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  endIndex = computed(() => {
    return Math.min(this.currentPage() * this.pageSize(), this.filteredSubscriptions().length);
  });

  totalItems = computed(() => this.filteredSubscriptions().length);

  onSearch(val: string) {
    this.searchQuery.set(val);
    this.currentPage.set(1);
  }

  onPlanFilterChange(plan: string) {
    this.selectedPlanFilter.set(plan);
    this.currentPage.set(1);
  }

  onStatusFilterChange(st: 'All' | 'active' | 'expired' | 'cancelled') {
    this.selectedStatusFilter.set(st);
    this.currentPage.set(1);
  }

  onDateFilterChange(filter: string) {
    this.selectedDateFilter.set(filter);
    this.currentPage.set(1);
  }

  onCustomStartDate(date: string) {
    this.customStartDate.set(date);
    this.currentPage.set(1);
  }

  onCustomEndDate(date: string) {
    this.customEndDate.set(date);
    this.currentPage.set(1);
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }

  setPageSize(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  getPageNumbers(): (number | string)[] {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [1];
    if (current > 3) {
      pages.push('...');
    }
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (current < total - 2) {
      pages.push('...');
    }
    pages.push(total);
    return pages;
  }

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

  getPlanClass(planName?: string): string {
    const p = (planName || '').toLowerCase();
    if (p.includes('month') || p.includes('30')) return 'plan-monthly';
    if (p.includes('15') || p.includes('biweekly')) return 'plan-15days';
    if (p.includes('week') || p.includes('7')) return 'plan-weekly';
    return 'plan-custom';
  }

  getPlanBadgeColor(planName?: string): { bg: string; text: string; border: string } {
    const p = (planName || '').toLowerCase();
    if (p.includes('month') || p.includes('30')) {
      return { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' };
    }
    if (p.includes('15') || p.includes('biweekly')) {
      return { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' };
    }
    return { bg: '#F3E8FF', text: '#7E22CE', border: '#E9D5FF' };
  }
}
