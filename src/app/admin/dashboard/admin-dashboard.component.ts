import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface KpiCard {
  label: string;
  value: string;
  icon: string;
  growth: string;
  growthPositive: boolean;
  color: string;
  bgColor: string;
}

interface RecentTransaction {
  patient: string;
  worker: string;
  amount: string;
  status: 'Paid' | 'Pending';
}

interface TopWorker {
  name: string;
  sessions: number;
  initial: string;
}

interface DonutSegment {
  label: string;
  percent: number;
  color: string;
  dashArray: string;
  dashOffset: number;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  selectedPeriod = signal<'Week' | 'Month'>('Month');

  kpis: KpiCard[] = [
    { label: 'Total Patients', value: '245', icon: '👥', growth: '+12%', growthPositive: true, color: '#2196F3', bgColor: '#EFF6FF' },
    { label: 'Workers', value: '5', icon: '👨‍⚕️', growth: '+0%', growthPositive: true, color: '#22C55E', bgColor: '#DCFCE7' },
    { label: 'Sessions', value: '1,240', icon: '📋', growth: '+18%', growthPositive: true, color: '#F4A62A', bgColor: '#FFF8E7' },
    { label: 'Total Revenue', value: '₹6,20,000', icon: '💰', growth: '+20%', growthPositive: true, color: '#EF4444', bgColor: '#FEE2E2' },
  ];

  recentTransactions: RecentTransaction[] = [
    { patient: 'Priya Mehta', worker: 'Rahul Sharma', amount: '₹500', status: 'Paid' },
    { patient: 'Amit Sharma', worker: 'Neha Gupta', amount: '₹500', status: 'Paid' },
    { patient: 'Rohit Verma', worker: 'Amit Verma', amount: '₹500', status: 'Pending' },
  ];

  topWorkers: TopWorker[] = [
    { name: 'Rahul Sharma', sessions: 124, initial: 'R' },
    { name: 'Neha Gupta', sessions: 98, initial: 'N' },
    { name: 'Amit Verma', sessions: 87, initial: 'A' },
  ];

  // Pre-computed donut segments (no arrow functions in template)
  donutSegments: DonutSegment[] = [];

  // Chart data — weeks
  chartData = [
    { week: 'Week 1', thisMonth: 1200, lastMonth: 900 },
    { week: 'Week 2', thisMonth: 1800, lastMonth: 1400 },
    { week: 'Week 3', thisMonth: 2200, lastMonth: 1700 },
    { week: 'Week 4', thisMonth: 2800, lastMonth: 2100 },
  ];

  chartMax = 3000;

  private paymentData = [
    { label: 'UPI', percent: 60, color: '#2196F3' },
    { label: 'Card', percent: 25, color: '#22C55E' },
    { label: 'Cash', percent: 15, color: '#F59E0B' },
  ];

  get paymentMethods() { return this.paymentData; }

  ngOnInit() {
    this.buildDonutSegments();
  }

  private buildDonutSegments(): void {
    const circumference = 2 * Math.PI * 45;
    let accumulated = 0;
    this.donutSegments = this.paymentData.map(method => {
      const dash = (method.percent / 100) * circumference;
      const offset = -(accumulated / 100) * circumference + circumference / 4;
      accumulated += method.percent;
      return {
        label: method.label,
        percent: method.percent,
        color: method.color,
        dashArray: `${dash} ${circumference - dash}`,
        dashOffset: offset
      };
    });
  }

  getBarHeight(value: number): number {
    return (value / this.chartMax) * 100;
  }
}
