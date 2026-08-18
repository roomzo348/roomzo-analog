import { Component, OnInit, HostListener, Inject, PLATFORM_ID,OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive, Router, RouterModule, NavigationEnd } from '@angular/router'; 
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';
import { FlatmateService } from '../../services/flatmate.service';
import { filter } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { ChatService } from '../../services/chat.service';
import { Subscription } from 'rxjs';
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, RouterLinkActive, RouterLink],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export default class HeaderComponent implements OnInit {
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
  private subs = new Subscription();
  constructor(
    private router: Router, 
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object ,
    private flatmateService: FlatmateService,
    private toastr: ToastrService ,
    private chatService: ChatService // ✅ Inject the ChatService here
  ) {
    this.isHomePage = this.router.url === '/' || this.router.url.startsWith('/#');
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.isHomePage = event.urlAfterRedirects === '/' || event.urlAfterRedirects.startsWith('/#');
    });
  }

  get pricingReturnQuery(): { returnUrl?: string } {
    const url = this.router.url || '';
    if (!url || url.startsWith('/pricing') || url.startsWith('/owner-auth')) return {};
    return { returnUrl: url };
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (isPlatformBrowser(this.platformId)) {
      this.isScrolled = window.scrollY > 50;
    }
  }


  ngOnInit() {
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
    });
    this.subs.add(
      this.chatService.incomingMessage$.subscribe(() => {
        this.hasUnreadMessages = true;
      })
    );
  }
ngOnDestroy() {
    this.subs.unsubscribe();
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
      this.router.navigate(['/owner-auth'], { queryParams: { returnUrl: '/post-flatmate' }});
      return;
    }
    this.router.navigate(['/post-flatmate']); 
  }
  openFavorites() {
    this.closeMenu();
    this.router.navigate(['/my-listings'], { queryParams: { tab: 'favorites' } });
  }
 openChatDrawer() {
    console.log("💬 Header Chat Button Clicked!");
    this.hasUnreadMessages = false; // ✅ 5. Clear the red dot when they open chats
    this.chatService.toggleChatDrawer(true);
    this.closeMenu();
  }
}