import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'roomzo-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly modeSubject = new BehaviorSubject<ThemeMode>('light');
  readonly mode$ = this.modeSubject.asObservable();

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (!isPlatformBrowser(this.platformId)) return;

    const saved = this.readStored();
    const initial =
      saved ??
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    this.apply(initial, false);
  }

  get mode(): ThemeMode {
    return this.modeSubject.value;
  }

  get isDark(): boolean {
    return this.modeSubject.value === 'dark';
  }

  toggle(): void {
    this.apply(this.isDark ? 'light' : 'dark');
  }

  setMode(mode: ThemeMode): void {
    this.apply(mode);
  }

  private apply(mode: ThemeMode, persist = true): void {
    this.modeSubject.next(mode);

    if (!isPlatformBrowser(this.platformId)) return;

    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    root.style.colorScheme = mode;
    document.body?.setAttribute('data-theme', mode);

    let themeMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.name = 'theme-color';
      document.head.appendChild(themeMeta);
    }
    themeMeta.content = mode === 'dark' ? '#0b1220' : '#f5f7f9';

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        /* ignore quota / private mode */
      }
    }
  }

  private readStored(): ThemeMode | null {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'dark' || value === 'light' ? value : null;
    } catch {
      return null;
    }
  }
}
