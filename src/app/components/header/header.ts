import { Component, OnInit, AfterViewInit, HostListener, Inject, PLATFORM_ID, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive, Router, RouterModule, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';
import { FlatmateService } from '../../services/flatmate.service';
import { filter } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { ChatService } from '../../services/chat.service';
import { ThemeService } from '../../services/theme.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, RouterLinkActive, RouterLink],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export default class HeaderComponent implements OnInit, AfterViewInit, OnDestroy {
  isLoggedIn = false;
  isOwner = false;
  isMenuOpen = false;
  userMobile = '';
  isScrolled = false;
  isHomePage = true;
  isPostMenuOpen = false;
  hasUnreadMessages = false;
  profilePhotoUrl = '';
  userInitial = 'U';
  isDarkMode = false;
  private subs = new Subscription();
  private resizeObserver?: ResizeObserver;

  @ViewChild('rzHeader', { static: true }) rzHeader?: ElementRef<HTMLElement>;

  constructor(
    private router: Router,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private flatmateService: FlatmateService,
    private toastr: ToastrService,
    private chatService: ChatService,
    private themeService: ThemeService
  ) {
    this.isHomePage = this.router.url === '/' || this.router.url.startsWith('/#');
    // Non-home pages always use solid scrolled chrome
    this.isScrolled = !this.isHomePage;
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.isHomePage = event.urlAfterRedirects === '/' || event.urlAfterRedirects.startsWith('/#');
      if (!this.isHomePage) {
        this.isScrolled = true;
      } else if (isPlatformBrowser(this.platformId)) {
        this.isScrolled = window.scrollY > 50;
      }
      // Home header chrome changes height — remeasure after view updates
      setTimeout(() => this.syncHeaderHeight(), 0);
    });
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (isPlatformBrowser(this.platformId)) {
      this.isScrolled = window.scrollY > 50;
    }
  }

  @HostListener('window:resize', [])
  onWindowResize() {
    this.syncHeaderHeight();
  }

  ngOnInit() {
    this.subs.add(
      this.themeService.mode$.subscribe((mode) => {
        this.isDarkMode = mode === 'dark';
      })
    );

    this.authService.refreshSessionIfNeeded();
    this.authService.isLoggedIn$.subscribe((status) => {
      this.isLoggedIn = status;

      if (status && isPlatformBrowser(this.platformId)) {
        this.isOwner = localStorage.getItem('userVerifiedWithOtp') === 'true';
        this.userMobile = localStorage.getItem('userEmail') || 'User';
        this.syncUserAvatar();
      } else {
        this.isOwner = false;
        this.userMobile = '';
        this.profilePhotoUrl = '';
        this.userInitial = 'U';
        this.isMenuOpen = false;
      }
      setTimeout(() => this.syncHeaderHeight(), 0);
    });
    this.subs.add(
      this.chatService.incomingMessage$.subscribe(() => {
        this.hasUnreadMessages = true;
      })
    );
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.syncHeaderHeight();
    const el = this.rzHeader?.nativeElement;
    if (el && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.syncHeaderHeight());
      this.resizeObserver.observe(el);
    }
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
    this.resizeObserver?.disconnect();
  }

  /** Exact flush on mobile; desktop uses fixed 52px CSS. Never allow collapsed height. */
  private syncHeaderHeight(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const el = this.rzHeader?.nativeElement;
    if (!el) return;
    // Desktop uses fixed CSS height — skip JS override to avoid gap
    if (window.innerWidth > 768) {
      document.documentElement.style.setProperty('--rz-header-height', '52px');
      return;
    }
    const measured = Math.ceil(el.getBoundingClientRect().height);
    const h = Math.max(measured, 56);
    document.documentElement.style.setProperty('--rz-header-height', `${h}px`);
  }

  private syncUserAvatar(): void {
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      const label = user?.displayName || user?.name || user?.email || this.userMobile || 'User';
      this.userInitial = label.charAt(0).toUpperCase();
      this.profilePhotoUrl = user?.profilePhotoUrl || '';
    } catch {
      this.userInitial = 'U';
      this.profilePhotoUrl = '';
    }
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  onProfileNavClick(event: Event): void {
    if (this.isLoggedIn) {
      this.isMenuOpen = false;
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.toggleMenu();
  }

  closeMenu() {
    this.isMenuOpen = false;
  }

  logout() {
    this.authService.logout().subscribe(() => {
      this.isLoggedIn = false;
      this.isOwner = false;
      this.userMobile = '';
      this.isMenuOpen = false;
      this.router.navigate(['/']);
    });
  }

  togglePostMenu() {
    this.isPostMenuOpen = !this.isPostMenuOpen;
  }

  handleListProperty() {
    this.isPostMenuOpen = false;
    this.router.navigate(['/list-property']);
  }

  handleListFlatmate() {
    this.isPostMenuOpen = false;

    if (!this.isLoggedIn) {
      this.toastr.warning('Please log in to post a flatmate requirement.', 'Authentication Required');
      this.router.navigate(['/owner-auth'], { queryParams: { returnUrl: '/post-flatmate' } });
      return;
    }
    this.router.navigate(['/post-flatmate']);
  }

  openFavorites() {
    this.closeMenu();
    if (!this.isLoggedIn) {
      this.router.navigate(['/owner-auth'], { queryParams: { returnUrl: '/my-listings?tab=favorites' } });
      return;
    }
    this.router.navigate(['/my-listings'], { queryParams: { tab: 'favorites' } });
  }

  openChatDrawer() {
    this.hasUnreadMessages = false;
    this.chatService.toggleChatDrawer(true);
    this.closeMenu();
  }
}
