import { Injectable, signal, computed, effect } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'auto';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'walkin_admin_theme_mode';

  // Selected preference ('light', 'dark', or 'auto')
  themeMode = signal<ThemeMode>(this.getInitialThemeMode());

  // Resolved active theme ('light' or 'dark')
  activeTheme = signal<'light' | 'dark'>(this.resolveActiveTheme(this.themeMode()));

  // Computed helper
  isDark = computed(() => this.activeTheme() === 'dark');

  private mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;

  constructor() {
    // Initial sync to DOM
    this.applyThemeToDom(this.activeTheme());

    // Listen to OS system theme changes
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaQueryListener = (e: MediaQueryListEvent) => {
        if (this.themeMode() === 'auto') {
          const newTheme = e.matches ? 'dark' : 'light';
          this.activeTheme.set(newTheme);
          this.applyThemeToDom(newTheme);
        }
      };
      mq.addEventListener('change', this.mediaQueryListener);
    }

    // Effect to apply changes whenever themeMode changes
    effect(() => {
      const mode = this.themeMode();
      const resolved = this.resolveActiveTheme(mode);
      this.activeTheme.set(resolved);
      this.applyThemeToDom(resolved);
      this.saveToStorage(mode);
    });
  }

  toggleTheme(): void {
    const next = this.isDark() ? 'light' : 'dark';
    this.setTheme(next);
  }

  setTheme(mode: ThemeMode): void {
    this.themeMode.set(mode);
    const resolved = this.resolveActiveTheme(mode);
    this.activeTheme.set(resolved);
    this.applyThemeToDom(resolved);
    this.saveToStorage(mode);
  }

  private resolveActiveTheme(mode: ThemeMode): 'light' | 'dark' {
    if (mode === 'auto') {
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return 'light';
    }
    return mode;
  }

  private applyThemeToDom(theme: 'light' | 'dark'): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;

    root.setAttribute('data-theme', theme);
    root.setAttribute('data-admin-theme', theme);

    if (theme === 'dark') {
      body.classList.add('admin-dark-theme');
      body.classList.remove('admin-light-theme');
    } else {
      body.classList.remove('admin-dark-theme');
      body.classList.add('admin-light-theme');
    }
  }

  private getInitialThemeMode(): ThemeMode {
    if (typeof window === 'undefined') return 'light';
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY) as ThemeMode;
      if (saved === 'light' || saved === 'dark' || saved === 'auto') {
        return saved;
      }
    } catch {
      // localStorage may fail in some environments
    }
    return 'light';
  }

  private saveToStorage(mode: ThemeMode): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.STORAGE_KEY, mode);
    } catch {
      // Ignore
    }
  }
}
