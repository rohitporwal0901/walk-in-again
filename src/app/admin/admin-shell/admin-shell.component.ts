import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  id: string;
  icon: string;
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

  sidebarOpen = signal<boolean>(true);
  searchQuery = signal<string>('');

  navItems: NavItem[] = [
    { id: 'nav-dashboard', icon: '📊', label: 'Dashboard', route: '/admin/dashboard' },
    { id: 'nav-subscriptions', icon: '💎', label: 'Subscriptions', route: '/admin/subscriptions' },
    { id: 'nav-patients', icon: '👥', label: 'Patients', route: '/admin/patients' },
    { id: 'nav-workers', icon: '👨‍⚕️', label: 'Workers', route: '/admin/workers' },
    { id: 'nav-sessions', icon: '📋', label: 'Sessions', route: '/admin/sessions' },
    { id: 'nav-transactions', icon: '💳', label: 'Transactions', route: '/admin/transactions' },
    { id: 'nav-reports', icon: '📈', label: 'Reports', route: '/admin/reports' },
    { id: 'nav-settings', icon: '⚙️', label: 'Settings', route: '/admin/settings' },
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
