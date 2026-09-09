import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { FlatmateService } from "../../services/flatmate.service";
import { AuthService } from "../../services/auth.service"; 
import { ChatService } from "../../services/chat.service"; 
import { environment } from "../../../environments/environment";
import { MatIconModule } from "@angular/material/icon";
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-flatmates',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './flatmates.html',
  styleUrls: ['./flatmates.css']
})
export default class FlatmatesComponent implements OnInit, OnDestroy {
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
  detailSheet: { type: 'bio' | 'location'; mate: any } | null = null;
  galleryMate: any | null = null;
  galleryIndex = 0;

  private imagePress: { x: number; y: number } | null = null;
  private imageDidSwipe = false;

  // NEW: UI States for Read More logic
  expandedBios: Record<number, boolean> = {};
  expandedLocations: Record<number, boolean> = {};
  carouselIndexes: Record<number, number> = {};
  savingPostIds = new Set<number>();
  savedPostIds = new Set<number>();

  private readonly CACHE_KEY = 'flatmate_feed_cache_v1';

  private readonly prefIcons: Record<string, string> = {
    'UPSC/SSC Aspirant': 'menu_book',
    'Pure Veg': 'eco',
    'Non-Veg Allowed': 'restaurant',
    'Quiet/Study Vibe': 'menu_book',
    'Early Riser': 'wb_sunny',
    'Night Owl': 'nights_stay',
    'Non-Smoker': 'smoke_free',
    'Fitness Enthusiast': 'fitness_center',
    'Working Professional': 'work',
  };

  constructor(
    private flatmateService: FlatmateService,
    private authService: AuthService,
    private router: Router,
    private chatService: ChatService, 
    private toastr : ToastrService,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) { }

  ngOnInit(): void {
    this.authService.isLoggedIn$.subscribe((status) => {
      this.isLoggedIn = status;
      if (status && isPlatformBrowser(this.platformId)) {
        this.loadFavoriteIds();
      }
    });

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
      this.loadFavoriteIds();
    }

    this.loadMemoryFeed();
    this.initializeLocation();
    this.lockMobileViewport();
  }

  ngOnDestroy(): void {
    this.closeGallery();
    this.unlockMobileViewport();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.galleryMate) {
        this.closeGallery();
        return;
      }
      if (this.detailSheet) this.closeDetailSheet();
      return;
    }
    if (!this.galleryMate) return;
    if (event.key === 'ArrowLeft') this.stepGallery(-1);
    if (event.key === 'ArrowRight') this.stepGallery(1);
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
    if (!isPlatformBrowser(this.platformId) || !navigator.geolocation) return;
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
    if (!dbPath) return this.flatmateService.sampleImageUrl;
    if (dbPath.startsWith('http')) return dbPath;

    const baseUrl = environment.hostingerUploadUrl || 'https://roomzo.in';
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const cleanPath = dbPath.replace(/^\/+/, '');
    return `${cleanBase}/${cleanPath}`;
  }

  imageError(event: Event): void {
    const element = event.target as HTMLImageElement;
    if (element.dataset['fallback'] === '1') return;
    element.dataset['fallback'] = '1';
    element.src = this.flatmateService.sampleImageUrl;
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

  getBio(mate: any): string {
    return mate?.bio || 'Looking for a clean and chill flatmate.';
  }

  isBioLong(mate: any): boolean {
    return this.getBio(mate).length > 70;
  }

  openDetailSheet(mate: any, type: 'bio' | 'location'): void {
    if (type === 'bio' && !this.isBioLong(mate)) return;
    this.detailSheet = { type, mate };
  }

  closeDetailSheet(): void {
    this.detailSheet = null;
  }

  openMaps(mate: any): void {
    if (!isPlatformBrowser(this.platformId) || !mate?.latitude || !mate?.longitude) return;
    window.open(`https://www.google.com/maps?q=${mate.latitude},${mate.longitude}`, '_blank');
  }

  getFullLocation(mate: any): string {
    return mate.flatAddress || mate.address || mate.location || mate.city || 'Location not specified';
  }

  truncateLocation(mate: any, max = 28): string {
    const full = this.getFullLocation(mate);
    return full.length > max ? full.substring(0, max) + '...' : full;
  }

  getInitial(name?: string): string {
    const letter = (name || 'R').trim().charAt(0);
    return letter ? letter.toUpperCase() : 'R';
  }

  getImages(mate: any): string[] {
    const images = (mate?.images || []).filter((img: string) => !!img);
    return images.length ? images : [this.flatmateService.sampleImageUrl];
  }

  currentSlide(mate: any): number {
    return this.carouselIndexes[mate.id] || 1;
  }

  onCarouselScroll(event: Event, postId: number): void {
    const el = event.target as HTMLElement;
    if (!el?.clientWidth) return;
    const index = Math.round(el.scrollLeft / el.clientWidth) + 1;
    this.carouselIndexes[postId] = Math.max(1, index);
  }

  onImagePress(event: TouchEvent | MouseEvent): void {
    const point = 'touches' in event ? event.touches[0] : event;
    if (!point) return;
    this.imagePress = { x: point.clientX, y: point.clientY };
    this.imageDidSwipe = false;
  }

  onImageMove(event: TouchEvent | MouseEvent): void {
    if (!this.imagePress) return;
    if (!('touches' in event) && event.buttons === 0) return;
    const point = 'touches' in event ? event.touches[0] : event;
    if (!point) return;
    if (Math.abs(point.clientX - this.imagePress.x) > 10 || Math.abs(point.clientY - this.imagePress.y) > 10) {
      this.imageDidSwipe = true;
    }
  }

  openGalleryFromCard(mate: any, event?: Event): void {
    event?.stopPropagation();
    if (this.imageDidSwipe) return;
    const target = event?.currentTarget as HTMLElement | undefined;
    const carousel = target?.classList?.contains('image-carousel')
      ? target
      : target?.querySelector?.('.image-carousel') as HTMLElement | null;
    let index = Math.max(0, (this.carouselIndexes[mate?.id] || 1) - 1);
    if (carousel?.clientWidth) {
      index = Math.max(0, Math.round(carousel.scrollLeft / carousel.clientWidth));
    }
    this.openGallery(mate, index);
  }

  openGallery(mate: any, index = 0): void {
    if (!mate) return;
    const images = this.getImages(mate);
    this.galleryMate = mate;
    this.galleryIndex = Math.max(0, Math.min(index, images.length - 1));
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.add('fm-gallery-open');
      setTimeout(() => this.syncGalleryScroll(), 0);
    }
  }

  closeGallery(): void {
    this.galleryMate = null;
    this.galleryIndex = 0;
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.remove('fm-gallery-open');
    }
  }

  onGalleryScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (!el?.clientWidth) return;
    this.galleryIndex = Math.max(0, Math.round(el.scrollLeft / el.clientWidth));
  }

  stepGallery(delta: number): void {
    if (!this.galleryMate) return;
    const total = this.getImages(this.galleryMate).length;
    this.goToGallerySlide(this.galleryIndex + delta, total);
  }

  goToGallerySlide(index: number, total?: number): void {
    if (!this.galleryMate) return;
    const count = total ?? this.getImages(this.galleryMate).length;
    this.galleryIndex = Math.max(0, Math.min(count - 1, index));
    this.syncGalleryScroll(true);
  }

  private syncGalleryScroll(smooth = false): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const track = document.querySelector('.fm-gallery-track') as HTMLElement | null;
    if (!track?.clientWidth) return;
    track.scrollTo({
      left: this.galleryIndex * track.clientWidth,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  formatBudget(mate: any): string {
    const raw = String(mate?.budget ?? mate?.rent ?? '0');
    const digits = raw.replace(/[^\d]/g, '');
    return digits || '0';
  }

  getDisplayTags(mate: any, max = 6): { icon: string; label: string }[] {
    const tags: { icon: string; label: string }[] = [];
    const seen = new Set<string>();
    const add = (icon: string, label: string) => {
      const key = label.toLowerCase();
      if (!label || seen.has(key)) return;
      seen.add(key);
      tags.push({ icon, label });
    };

    add('group', 'Looking for Flatmate');
    add('home', 'Shared Flat');

    for (const pref of mate?.preferences || []) {
      add(this.prefIcons[pref] || 'label', pref);
    }

    const haystack = `${mate?.bio || ''} ${this.getFullLocation(mate)}`.toLowerCase();
    if (/ground\s*floor/.test(haystack)) add('stairs', 'Ground Floor');
    if (/spacious/.test(haystack)) add('open_with', 'Spacious Room');
    if (/metro|bus|connect/.test(haystack)) add('directions_bus', 'Good Connectivity');
    if (/safe|gated|colony/.test(haystack)) add('verified_user', 'Safe Locality');

    return tags.slice(0, max);
  }

  private lockMobileViewport(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.body.classList.add('fm-single-view');
  }

  private unlockMobileViewport(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.body.classList.remove('fm-single-view');
  }

  goBack(): void {
    if (isPlatformBrowser(this.platformId) && window.history.length > 1) {
      window.history.back();
      return;
    }
    this.router.navigate(['/']);
  }

  openLocation(mate: any): void {
    if (isPlatformBrowser(this.platformId) && mate?.latitude && mate?.longitude) {
      window.open(`https://www.google.com/maps?q=${mate.latitude},${mate.longitude}`, '_blank');
      return;
    }
    this.toggleLocation(mate.id);
  }

  isSaved(postId: number): boolean {
    return this.savedPostIds.has(Number(postId));
  }

  private syncSavedIds(): void {
    this.savedPostIds = new Set(this.flatmateService.getFavoritePostIds().map((id) => Number(id)));
  }

  toggleSave(postId: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.isLoggedIn) {
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('pendingFavoriteFlatmateId', String(postId));
      }
      this.toastr.warning('Please log in to save this flatmate.', 'Authentication Required');
      this.router.navigate(['/owner-auth'], { queryParams: { returnUrl: '/flatmates' }});
      return;
    }

    if (this.savingPostIds.has(postId)) return;

    const nextValue = !this.isSaved(postId);
    this.savingPostIds.add(postId);
    const request = nextValue
      ? this.flatmateService.saveFavoritePost(postId)
      : this.flatmateService.removeFavoritePost(postId);

    request.subscribe({
      next: (res: any) => {
        this.savingPostIds.delete(postId);
        if (res?.status === 1 || res?.status === '1') {
          this.syncSavedIds();
          this.toastr.success(nextValue ? 'Flatmate saved to favorites.' : 'Flatmate removed from favorites.');
        } else {
          this.toastr.error(res?.message || 'Could not update favorites right now.');
        }
      },
      error: () => {
        this.savingPostIds.delete(postId);
        this.toastr.error('Could not update favorites right now.');
      }
    });
  }

  private loadFavoriteIds(): void {
    if (!this.isLoggedIn && !this.currentUserId) return;
    this.flatmateService.getFavoritePosts().subscribe({
      next: () => {
        this.syncSavedIds();
        this.applyPendingFavorite();
      },
      error: () => this.syncSavedIds()
    });
  }

  private applyPendingFavorite(): void {
    if (!isPlatformBrowser(this.platformId) || !this.isLoggedIn) return;
    const pending = localStorage.getItem('pendingFavoriteFlatmateId');
    if (!pending) return;
    localStorage.removeItem('pendingFavoriteFlatmateId');
    const postId = Number(pending);
    if (!postId || this.isSaved(postId)) return;
    this.flatmateService.saveFavoritePost(postId).subscribe({
      next: (res: any) => {
        if (res?.status === 1 || res?.status === '1') {
          this.syncSavedIds();
          this.toastr.success('Flatmate saved to favorites.');
        }
      }
    });
  }

  contactNow(mate: any, event: Event): void {
    if (mate?.phoneNumber) {
      this.initiateCall(mate.phoneNumber, event);
      return;
    }
    this.toastr.info('Contact number is not available for this listing.');
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