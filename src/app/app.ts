import { Component, inject, ChangeDetectorRef, PLATFORM_ID, OnInit } from '@angular/core';
import {
  RouterOutlet,
  Router,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError
} from '@angular/router';

import { CommonModule } from '@angular/common';
import { FooterComponent } from './components/footer/footer';
import HeaderComponent from './components/header/header';
import { ChatDrawerComponent } from './components/chat-drawer/chat-drawer';
import { AnalyticsService } from './services/analytics.service';
import { PropertyService } from './services/property.service';

import { MatDialog } from '@angular/material/dialog';
import { ComingSoonModalComponent } from './components/coming-soon/coming-soon-modal';
import { isPlatformBrowser } from '@angular/common';
import { ChatBotComponent } from "./components/chat-bot/chat-bot";
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    FooterComponent,
    CommonModule,
    ChatDrawerComponent
],
  template: `
    <div *ngIf="isRouteLoading" class="global-loader"></div>

    <app-header></app-header>

    <main class="main-content">
      <router-outlet></router-outlet>
    </main>

    <app-footer></app-footer>

    <app-chat-drawer></app-chat-drawer>
     <!-- <app-chat-bot></app-chat-bot> -->
  `,
  styles: [`
    .global-loader {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 4px;
      background: #008080;
      z-index: 9999;
      animation: loading 2s infinite ease-in-out;
    }

    @keyframes loading {
      0% {
        transform: translateX(-100%);
      }

      100% {
        transform: translateX(100%);
      }
    }

    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .main-content {
      flex: 1;
    }
  `],
})
export class App implements OnInit {
  isRouteLoading = false;

  private router = inject(Router);
  private cd = inject(ChangeDetectorRef);
  private analytics = inject(AnalyticsService);
  private dialog = inject(MatDialog);
  private propertyService = inject(PropertyService);
  private platformId = inject(PLATFORM_ID);

  constructor() {
    this.router.events.subscribe((event) => {
    if (event instanceof NavigationStart) {
      this.isRouteLoading = true;
      this.cd.detectChanges();
    } else if (
      event instanceof NavigationEnd ||
      event instanceof NavigationCancel ||
      event instanceof NavigationError
    ) {
      setTimeout(() => {
        this.isRouteLoading = false;
        this.cd.detectChanges();
      }, 600);
    }
  });

    this.analytics.init();
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadFavoriteState();
      this.initComingSoonModal();
    }
  }

  private loadFavoriteState(): void {
    const storedUser = this.getStoredUser();
    if (!storedUser?.id) {
      return;
    }

    this.propertyService.getFavoriteProperties().subscribe({
      next: () => undefined,
      error: () => undefined,
    });
  }

  private getStoredUser(): any {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    try {
      return JSON.parse(window.localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }

 private initComingSoonModal(): void {
  // Versioned so existing visitors see the newly added plan launch notice once.
  const STORAGE_KEY = 'roomzo-live-cities-modal-v2';
  const COOLDOWN_HOURS = 2;

  setTimeout(() => {
    const lastShown = localStorage.getItem(STORAGE_KEY);

    if (lastShown) {
      const hoursPassed =
        (Date.now() - Number(lastShown)) / (1000 * 60 * 60);

      if (hoursPassed < COOLDOWN_HOURS) {
        return;
      }
    }

    const dialogRef = this.dialog.open(ComingSoonModalComponent, {
      width: '520px',
      maxWidth: '92vw',
      maxHeight: '96vh',
      autoFocus: false,
      panelClass: 'roomzo-live-modal-panel',
    });

    dialogRef.afterClosed().subscribe(() => {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    });
  }, 3000);
}
}