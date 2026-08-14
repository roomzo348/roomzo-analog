import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { FlatmateService } from "../../services/flatmate.service";
import { AuthService } from "../../services/auth.service"; 
import { ChatService } from "../../services/chat.service"; 
import { environment } from "../../environments/environment";
import { MatIconModule } from "@angular/material/icon";
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-flatmates',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './flatmates.html',
  styleUrls: ['./flatmates.css']
})
export default class FlatmatesComponent implements OnInit {
  flatmates: any[] = [];
  loading = false;
  loadingMore = false;
  page = 0;
  size = 10;
  hasMore = true;
  latitude?: number;
  longitude?: number;
  isLoggedIn = false;
  currentUserId: number | null = null; 

  // Modal State
  showDeleteModal = false;
  postToDeleteId: number | null = null;

  // NEW: UI States for Read More logic
  expandedBios: Record<number, boolean> = {};
  expandedLocations: Record<number, boolean> = {};

  private readonly CACHE_KEY = 'flatmate_feed_cache_v1';

  constructor(
    private flatmateService: FlatmateService,
    private authService: AuthService,
    private router: Router,
    private chatService: ChatService, 
    private toastr : ToastrService,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) { }

  ngOnInit(): void {
    this.authService.isLoggedIn$.subscribe(status => this.isLoggedIn = status);

    if (isPlatformBrowser(this.platformId)) {
      let storedId = localStorage.getItem('userId');
      if (!storedId) {
        const userJson = localStorage.getItem('user');
        if (userJson) {
          try {
            const userObj = JSON.parse(userJson);
            storedId = userObj.id || userObj.userId;
          } catch(e) {}
        }
      }
      if (storedId) {
        this.currentUserId = parseInt(storedId.toString(), 10);
      }
      this.loadCache();
    }

    this.loadMemoryFeed();
    this.initializeLocation();
  }

  loadCache() {
    if (isPlatformBrowser(this.platformId)) {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (cached) {
        this.flatmates = JSON.parse(cached);
      }
    }
  }

  saveCache() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.flatmates));
    }
  }

  loadMemoryFeed() {
    this.loading = true;
    this.flatmateService.getMemoryFeed().subscribe({
      next: (res: any) => {
        const posts = res?.data || [];
        if (posts.length) {
          this.flatmates = posts;
          this.saveCache();
        }
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  initializeLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.latitude = position.coords.latitude;
        this.longitude = position.coords.longitude;
        this.loadMorePosts();
      },
      () => { console.log('Location permission denied'); }
    );
  }

  loadMorePosts() {
    if (this.loadingMore || !this.hasMore) return;
    this.loadingMore = true;

    this.flatmateService.getNearbyFeed(this.page, this.size, this.latitude, this.longitude).subscribe({
      next: (res: any) => {
        const posts = res?.data?.content || [];
        if (posts.length < this.size) this.hasMore = false;

        const existingIds = new Set(this.flatmates.map(x => x.id));
        const uniquePosts = posts.filter((x: any) => !existingIds.has(x.id));

        this.flatmates = [...this.flatmates, ...uniquePosts];
        this.saveCache();
        this.page++;
        this.loadingMore = false;
      },
      error: () => { this.loadingMore = false; }
    });
  }

  onScroll(event: any) {
    const element = event.target;
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining < 1200) this.loadMorePosts();
  }

  scrollToTop() {
    const feed = document.querySelector('.feed-container');
    if (feed) feed.scrollTo({ top: 0, behavior: 'smooth' });
  }

  get allCaughtUp() {
    return !this.hasMore && this.flatmates.length > 0;
  }

  trackByPostId(index: number, item: any) {
    return item.id;
  }

  getImageUrl(dbPath: string): string {
    if (!dbPath) return 'assets/images/flatmate-placeholder.jpg';
    if (dbPath.startsWith('http')) return dbPath;

    const baseUrl = environment.hostingerUploadUrl || 'https://roomzo.in';
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const cleanPath = dbPath.replace(/^\/+/, '');
    return `${cleanBase}/${cleanPath}`;
  }

  imageError(event: Event): void {
    const element = event.target as HTMLImageElement;
    element.src = 'assets/images/flatmate-placeholder.jpg';
  }

  scrollCarousel(carouselElement: HTMLElement, direction: number): void {
    if (!carouselElement) return;
    const scrollAmount = carouselElement.clientWidth;
    carouselElement.scrollBy({
      left: direction * scrollAmount,
      behavior: 'smooth'
    });
  }

  // --- UI Toggle Handlers ---

  toggleBio(postId: number) {
    this.expandedBios[postId] = !this.expandedBios[postId];
  }

  toggleLocation(postId: number) {
    this.expandedLocations[postId] = !this.expandedLocations[postId];
  }

  getFullLocation(mate: any): string {
    return mate.flatAddress || mate.address || mate.location || mate.city || 'Location not specified';
  }

  truncateLocation(mate: any): string {
    const full = this.getFullLocation(mate);
    return full.length > 28 ? full.substring(0, 28) + '...' : full;
  }

  // --- WhatsApp Formatting ---
  getWhatsAppLink(phone: string): string {
    const cleanPhone = phone?.replace(/\D/g, '') || '';
    const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    return `https://wa.me/${finalPhone}`;
  }

  // --- Action Handlers with Login Checks ---

  initiateCall(phone: string, event: Event) {
    event.preventDefault();
    if (!this.isLoggedIn) {
      this.toastr.warning('Please log in to contact the flatmate.', 'Authentication Required');
      this.router.navigate(['/owner-auth'], { queryParams: { returnUrl: '/flatmates' }});
      return;
    }
    window.location.href = `tel:${phone}`;
  }

  initiateWhatsApp(phone: string, event: Event) {
    event.preventDefault();
    if (!this.isLoggedIn) {
      this.toastr.warning('Please log in to contact the flatmate.', 'Authentication Required');
      this.router.navigate(['/owner-auth'], { queryParams: { returnUrl: '/flatmates' }});
      return;
    }
    const link = this.getWhatsAppLink(phone);
    window.open(link, '_blank');
  }

  messageOwner(ownerId: number, ownerName: string) {
    if (!this.isLoggedIn) {
      this.toastr.warning('Please log in to contact the flatmate.', 'Authentication Required');
      this.router.navigate(['/owner-auth'], { queryParams: { returnUrl: '/flatmates' }});
      return;
    }

    if (this.currentUserId === ownerId) {
      return; 
    }

    this.chatService.openChatWith(ownerId, ownerName);
  }

  handleListFlatmate() {
    if (!this.isLoggedIn) {
      this.toastr.warning('Please log in to post a flatmate requirement.', 'Authentication Required');
      this.router.navigate(['/owner-auth'], { queryParams: { returnUrl: '/post-flatmate' }});
      return;
    }
    this.router.navigate(['/post-flatmate']); 
  }

  // =========================================
  // DELETE MODAL LOGIC
  // =========================================

  openDeleteModal(postId: number) {
    this.postToDeleteId = postId;
    this.showDeleteModal = true;
  }

  cancelDelete() {
    this.showDeleteModal = false;
    this.postToDeleteId = null;
  }

  confirmDelete() {
    if (!this.postToDeleteId) return;

    this.flatmateService.deletePost(this.postToDeleteId).subscribe({
      next: (res: any) => {
        if (res.status === 1) {
          this.toastr.success('Post deleted successfully');
          this.flatmates = this.flatmates.filter(mate => mate.id !== this.postToDeleteId);
          this.saveCache(); 
        } else {
          this.toastr.error(res.message || 'Failed to delete post');
        }
        this.cancelDelete(); 
      },
      error: () => {
        this.toastr.error('Error deleting post. Please try again.');
        this.cancelDelete(); 
      }
    });
  }
}