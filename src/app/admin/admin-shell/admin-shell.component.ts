import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

interface NavItem {
  id: string;
  iconType: 'dashboard' | 'subscriptions' | 'patients' | 'workers' | 'sessions' | 'transactions' | 'reports' | 'settings';
  label: string;
  route: string;
}

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.scss'
})
export class AdminShellComponent {
  private auth = inject(AuthService);
  themeService = inject(ThemeService);

  sidebarOpen = signal<boolean>(true);
  searchQuery = signal<string>('');

  navItems: NavItem[] = [
    { id: 'nav-dashboard', iconType: 'dashboard', label: 'Dashboard', route: '/admin/dashboard' },
    { id: 'nav-subscriptions', iconType: 'subscriptions', label: 'Subscriptions', route: '/admin/subscriptions' },
    { id: 'nav-patients', iconType: 'patients', label: 'Patients', route: '/admin/patients' },
    { id: 'nav-workers', iconType: 'workers', label: 'Workers', route: '/admin/workers' },
    { id: 'nav-sessions', iconType: 'sessions', label: 'Sessions', route: '/admin/sessions' },
    { id: 'nav-transactions', iconType: 'transactions', label: 'Transactions', route: '/admin/transactions' },
    // { id: 'nav-reports', iconType: 'reports', label: 'Reports', route: '/admin/reports' },
    { id: 'nav-settings', iconType: 'settings', label: 'Settings', route: '/admin/settings' },
  ];

  showLogoutConfirm = signal<boolean>(false);

  toggleSidebar() { this.sidebarOpen.update(v => !v); }

  openLogoutConfirm() {
    this.showLogoutConfirm.set(true);
  }

  closeLogoutConfirm() {
    this.showLogoutConfirm.set(false);
  }

  confirmLogout() {
    this.showLogoutConfirm.set(false);
    this.auth.logout();
  }
}
