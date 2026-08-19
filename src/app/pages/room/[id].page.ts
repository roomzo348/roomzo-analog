import { Component, OnInit, ChangeDetectorRef, OnDestroy, CUSTOM_ELEMENTS_SCHEMA, Inject, PLATFORM_ID, Renderer2, signal, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser, DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PropertyService } from '../../services/property.service';
import { ActivityService } from '../../services/activity.service';
import { Subscription, switchMap, tap } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ToastrService } from 'ngx-toastr';
import { getAmenitiesMap, getListingConditionsMap } from '../../services/Utility';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { SeoService } from '../../services/seo.service';
import { RelatedSearchesComponent } from '../../components/related-searches/related-searches';
import { SeoBreadcrumbComponent } from '../../components/seo-breadcrumb/seo-breadcrumb';
import {
  generatePropertyAltText,
  optimizeImageUrl,
} from '../../utils/image-seo.util';
import { slugifyCity } from '../../config/cities.config';

import { PendingAction, SafetyConsentBottomSheetComponent } from '../../components/safety-consent/safety-consent';
import { ContactAccessService } from '../../services/contact-access.service';
import { paymentReturnNotice } from '../../utils/billing-return';

@Component({
  selector: 'app-property-details',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, RouterLink, FormsModule, SafetyConsentBottomSheetComponent, RelatedSearchesComponent, SeoBreadcrumbComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './property-details.html',
  styleUrls: ['./property-details.css']
})
export default class PropertyDetailsComponent implements OnInit, OnDestroy, AfterViewInit {
  property: any | undefined;
  similarProperties: any[] = [];
  displayAmenities: any[] = [];
  displayConditions: any[] = [];
  reviews: any[] = [];
  avgRating = 0;
  reviewCount = 0;
  reviewRating = 5;
  reviewComment = '';
  isSubmittingReview = false;
  isLoadingReviews = false;
  isLoadingContact = false; 
  contactHint = '';
  creditsRemaining: number | null = null;
  contactUnlocked = false;
  private contactStatusListingId: number | null = null; 

  isLoading = true;
  showFullDescription = false;
  ownerName: string = 'Property Owner';
  currentId: string | null = null;
  mapUrl: SafeResourceUrl | null = null; 
  isCopied = false;

  showContactModal = false;
  showReportModal = false;
  reportReason = '';
  reportDescription = '';
  
  reportReasonsList = [
    'Scam or Fraud',
    'Incorrect Information',
    'Property No Longer Available',
    'Offensive Content',
    'Other'
  ];

  ownerDetails = {
    name: 'Property Owner',
    ownerPhone: '',
    propertyPhone: '',
    email: ''
  };

  isBrowser = isPlatformBrowser(this.platformId);
  activePhotoIndex = 0;
  zoomViewerOpen = false;
  zoomPhotoIndex = 0;
  zoomScale = 1;
  zoomPanX = 0;
  zoomPanY = 0;
  @ViewChild('galleryScroll') galleryScroll?: ElementRef<HTMLElement>;
  @ViewChild('thumbStrip') thumbStrip?: ElementRef<HTMLElement>;
  private scrollRaf: number | null = null;
  private zoomTouchState = {
    mode: 'none' as 'none' | 'pan' | 'pinch' | 'swipe',
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    startDistance: 0,
    startScale: 1,
    lastTap: 0,
  };
  private routeSub: Subscription | null = null;

  userHasGivenConsent = signal(false); 
  isConsentModalOpen = signal(false);
  pendingAction = signal<PendingAction | any>(null);

  readonly generatePropertyAltText = generatePropertyAltText;
  readonly optimizeImageUrl = optimizeImageUrl;
  breadcrumbItems: { label: string; path?: string }[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private propertyService: PropertyService,
    private activityService: ActivityService,
    private cd: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private toastr: ToastrService,
    private authService: AuthService,
    private seo: SeoService,
    private contactAccess: ContactAccessService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.pipe(
      tap(() => {
        this.isLoading = true;
        this.property = undefined;
        this.similarProperties = [];
        this.mapUrl = null; 
        this.showContactModal = false;
        this.resetOwnerDetails();
        this.contactHint = '';
        this.creditsRemaining = null;
        this.contactUnlocked = false;
        this.contactStatusListingId = null;
        this.activePhotoIndex = 0; 
        
        if (this.isBrowser) {
          window.scrollTo(0, 0);
          this.renderer.addClass(this.document.body, 'hide-global-bottom-nav');
          this.renderer.addClass(this.document.body, 'immersive-detail-page');
        }
        
        this.cd.detectChanges();
      }),
      switchMap(params => {
        this.currentId = params.get('id');
        if (!this.currentId) {
            this.toastr.error('Invalid Property ID', 'Error');
            throw new Error('No ID');
        }
        if (this.isBrowser && this.router.url.includes('/property-details/')) {
          this.router.navigate(['/room', this.currentId], { replaceUrl: true });
        }
        return this.propertyService.getListingById(this.currentId);
      })
    ).subscribe({
      next: (response: any) => {
        if (response.status === 1 && response.data) {
          this.property = response.data;

          this.activityService.logPropertyView(this.property.id, {
            ownerId: this.property.ownerId,
            city: this.property.city,
            state: this.property.state,
            zone: this.property.zone
          });

          this.ownerName = response.ownerName || 'Property Owner';
          this.ownerDetails.name = this.ownerName;
          this.contactUnlocked = Boolean(this.property.contactUnlocked);
          this.syncContactFromProperty();
          this.loadContactStatus();
          if (this.property.guidebook && Array.isArray(this.property.guidebook.rules)) {
            this.property.guidebook.rules = this.property.guidebook.rules.filter(
              (r: any) => (r && r.ruleText) || (typeof r === 'string' && r.trim() !== '')
            );
          }
          this.mapAmenities(this.property);
          this.mapConditions(this.property);
          this.loadReviews(this.property.id);
          this.applyPropertySeo(this.property);
          this.checkReturnFromLogin();
          this.checkFocusContact();
          if (this.isBrowser) {
            this.loadMapCoordinates(this.property);
            this.loadSuggestions(this.property);
          }

        } else {
            this.toastr.warning('Property data not found', 'Not Found');
        }
        this.isLoading = false;
        this.cd.detectChanges();
        if (this.isBrowser && this.property) {
          setTimeout(() => this.syncGalleryToIndex(0, false), 0);
        }
      },
      error: (err) => {
        console.error('Error:', err);
        this.toastr.error('Failed to load property details.', 'Server Error');
        this.isLoading = false;
        this.cd.detectChanges();
      }
    });
  }
private checkAndExecuteConsent(actionData: any, successCallback: () => void) {
    if (this.userHasGivenConsent() || (this.isBrowser && localStorage.getItem('safetyConsentGiven') === 'true')) {
      this.userHasGivenConsent.set(true);
      successCallback();
      return;
    }

    let userId = null;
    if (this.isBrowser) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try { userId = JSON.parse(storedUser).id; } catch (e) {}
      }
    }

    if (userId) {
      this.propertyService.checkSafetyConsent(userId).subscribe({
        next: (res: any) => {
          console.log("Backend Response:", res); // Debug log
          if (res.status === 1 && res.hasConsent) {
            if (this.isBrowser) localStorage.setItem('safetyConsentGiven', 'true');
            this.userHasGivenConsent.set(true);
            successCallback();
          } else {
            console.log("Opening Modal..."); // Debug log
            // Not in DB -> Show Modal
            this.pendingAction.set(actionData);
            this.isConsentModalOpen.set(true);
            
            // ADD THIS LINE: Force Angular to update the UI immediately
            this.cd.detectChanges(); 
          }
        },
        error: () => {
          this.pendingAction.set(actionData);
          this.isConsentModalOpen.set(true);
          this.cd.detectChanges(); // ADD THIS LINE HERE TOO
        }
      });
    } else {
      this.pendingAction.set(actionData);
      this.isConsentModalOpen.set(true);
      this.cd.detectChanges(); // AND HERE
    }
  }

  // Triggered via Desktop Sidebar
  contactAgent() {
    if (!this.isContactAvailable()) {
      this.toastr.info('This property is currently marked as rented.', 'Unavailable');
      return;
    }
    if (this.isUserLoggedIn() || this.isOwnerLoggedIn()) {
      if (this.property?.id) {
        this.activityService.logPropertyContact(this.property.id, 'modal', {
          ownerId: this.property.ownerId
        });
      }
      const actionPayload = { actionType: 'contactOwnerModal' };
      
      this.checkAndExecuteConsent(actionPayload, () => {
        this.unlockThenShowContact();
      });
    } else {
      const returnUrl = `/room/${this.currentId}?showContact=true`;
      this.router.navigate(['/owner-auth'], { queryParams: { returnUrl: returnUrl } });
    }
  }

  // Triggered via Mobile Bottom Bar
  handleContactAction(actionType: 'call' | 'whatsapp') {
    if (!this.isContactAvailable()) {
      this.toastr.info('This property is currently marked as rented.', 'Unavailable');
      return;
    }
    if (this.isUserLoggedIn() || this.isOwnerLoggedIn()) {
      if (this.property?.id) {
        this.activityService.logPropertyContact(this.property.id, actionType, {
          ownerId: this.property.ownerId
        });
      }
      this.checkAndExecuteConsent({ actionType }, () => {
        this.unlockThenContact(actionType);
      });
    } else {
      const returnUrl = `/room/${this.currentId}?action=${actionType}`;
      this.router.navigate(['/owner-auth'], { queryParams: { returnUrl: returnUrl } });
    }
  }

  private executeContactAction(actionType: 'call' | 'whatsapp') {
    const phoneValue = this.ownerDetails.propertyPhone || this.ownerDetails.ownerPhone;
    const phone = phoneValue ? String(phoneValue) : null;

    if (!phone) {
      this.toastr.error('Phone number not available');
      return;
    }

    this.propertyService.triggerPhoneAndWP(phone, actionType, this.property);
  }

  private unlockThenShowContact(): void {
    if (!this.property?.id) return;
    this.isLoadingContact = true;
    this.contactAccess.requestOwnerContact(Number(this.property.id), `/room/${this.currentId}?showContact=true`).subscribe({
      next: (result) => {
        this.isLoadingContact = false;
        if (!result?.unlocked) {
          this.clearUnlockedContactState();
          this.showContactModal = false;
          this.cd.detectChanges();
          return;
        }
        this.applyUnlockResult(result);
        this.showContactModal = true;
        this.cd.detectChanges();
      },
      error: () => {
        this.isLoadingContact = false;
        this.showContactModal = false;
        this.cd.detectChanges();
      },
    });
  }

  private unlockThenContact(actionType: 'call' | 'whatsapp'): void {
    if (!this.property?.id) return;
    // The unlock round-trip decides whether the paywall opens, so show the
    // button spinner meanwhile instead of leaving the tap unacknowledged.
    this.isLoadingContact = true;
    this.cd.detectChanges();
    this.contactAccess.requestOwnerContact(Number(this.property.id), `/room/${this.currentId}?action=${actionType}`).subscribe({
      next: (result) => {
        this.isLoadingContact = false;
        if (!result?.unlocked) {
          this.clearUnlockedContactState();
          this.cd.detectChanges();
          return;
        }
        this.applyUnlockResult(result);
        this.executeContactAction(actionType);
        this.cd.detectChanges();
      },
      error: () => {
        this.isLoadingContact = false;
        this.cd.detectChanges();
      },
    });
  }

  private applyUnlockResult(result: any): void {
    if (!result?.unlocked) {
      this.clearUnlockedContactState();
      return;
    }
    const contact = result?.contact || {};
    this.ownerDetails = {
      name: contact.name || this.ownerName || 'Property Owner',
      ownerPhone: contact.ownerPhone || '',
      propertyPhone: contact.propertyPhone || contact.phone || '',
      email: contact.email || '',
    };
    if (this.property) {
      this.property.contactNo = this.ownerDetails.propertyPhone || undefined;
      this.property.tempContactNo = this.ownerDetails.propertyPhone || undefined;
      this.property.contactUnlocked = true;
    }
    this.contactUnlocked = true;
    if (typeof result.creditsRemaining === 'number') {
      this.creditsRemaining = result.creditsRemaining;
    }
    this.contactHint = this.buildContactHint(result);
  }

  private clearUnlockedContactState(): void {
    this.contactUnlocked = false;
    this.resetOwnerDetails();
    this.ownerDetails.name = this.ownerName || 'Property Owner';
    if (this.property) {
      delete this.property.contactNo;
      delete this.property.tempContactNo;
      this.property.contactUnlocked = false;
    }
  }

  private loadContactStatus(): void {
    if (!this.isBrowser || !this.property?.id || !(this.isUserLoggedIn() || this.isOwnerLoggedIn())) return;
    const listingId = Number(this.property.id);
    this.contactStatusListingId = listingId;
    this.contactAccess.getStatus(listingId).subscribe({
      next: (res) => {
        if (this.contactStatusListingId !== listingId || Number(this.property?.id) !== listingId) return;
        const data = res?.data;
        if (!data) return;
        const unlocked = Boolean(data.unlocked || data.isOwner);
        this.creditsRemaining = typeof data.creditsRemaining === 'number' ? data.creditsRemaining : this.creditsRemaining;
        if (unlocked) {
          this.contactUnlocked = true;
          this.contactHint = this.buildContactHint(data);
          this.syncContactFromProperty();
        } else {
          this.clearUnlockedContactState();
          this.contactHint = this.buildContactHint(data);
        }
        this.cd.detectChanges();
      },
      error: () => undefined,
    });
  }

  private buildContactHint(data: any): string {
    if (data?.unlocked || data?.isOwner || data?.unlockType === 'owner') {
      return 'This owner contact is unlocked for you.';
    }
    if (typeof data?.creditsRemaining === 'number' && data.creditsRemaining > 0) {
      return `${data.creditsRemaining} contact credit${data.creditsRemaining === 1 ? '' : 's'} left. Credits never expire.`;
    }
    return 'Buy a plan to view owner phone, WhatsApp, or email.';
  }

  openContactModal() {
    this.unlockThenShowContact();
  }

  private fetchOwnerDetailsForContact(onSuccess: () => void, showLoader = true): void {
    if (!this.property?.id) {
      this.toastr.error('Owner information not available');
      return;
    }
    if (showLoader) this.isLoadingContact = true;
    this.contactAccess.requestOwnerContact(Number(this.property.id)).subscribe({
      next: (result) => {
        this.isLoadingContact = false;
        if (result?.unlocked) {
          this.applyUnlockResult(result);
          onSuccess();
        }
        this.cd.detectChanges();
      },
      error: () => {
        this.isLoadingContact = false;
        this.cd.detectChanges();
      },
    });
  }

  onConsentAccepted(action: any) {
    let userId = null;
    if (this.isBrowser) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try { userId = JSON.parse(storedUser).id; } catch (e) {}
      }
    }

    const proceedWithAction = () => {
      if (action.actionType === 'contactOwnerModal') {
        this.unlockThenShowContact();
      } else {
        this.unlockThenContact(action.actionType);
      }
    };

    if (userId) {
      this.propertyService.updateSafetyConsent(userId, true).subscribe({
        next: (res: any) => {
          if (res.status === 1) {
            this.userHasGivenConsent.set(true);
            if (this.isBrowser) localStorage.setItem('safetyConsentGiven', 'true');
            proceedWithAction();
          } else {
            this.toastr.error('Failed to record consent. Please try again.');
          }
        },
        error: (err) => {
          console.error('Consent save error:', err);
          this.toastr.error('Server error while recording consent.');
        }
      });
    } else {
      this.userHasGivenConsent.set(true);
      if (this.isBrowser) localStorage.setItem('safetyConsentGiven', 'true');
      proceedWithAction();
    }
  }

  // ... (All other existing methods remain exactly the same: isUserLoggedIn, openContactModal, loadMapCoordinates, shareProperty, etc.)
  
  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.syncGalleryToIndex(0, false);
    }
  }

  @HostListener('window:resize')
  onGalleryResize(): void {
    if (this.isBrowser) {
      this.syncGalleryToIndex(this.activePhotoIndex, false);
    }
  }

  get zoomTransform(): string {
    return `translate3d(${this.zoomPanX}px, ${this.zoomPanY}px, 0) scale(${this.zoomScale})`;
  }

  openZoomViewer(index: number, event?: Event): void {
    event?.stopPropagation();
    if (!this.isBrowser) return;
    this.zoomPhotoIndex = index;
    this.resetZoomTransform();
    this.zoomViewerOpen = true;
    this.renderer.addClass(this.document.body, 'zoom-viewer-open');
    this.cd.markForCheck();
  }

  closeZoomViewer(): void {
    this.zoomViewerOpen = false;
    this.resetZoomTransform();
    this.renderer.removeClass(this.document.body, 'zoom-viewer-open');
    this.cd.markForCheck();
  }

  zoomPrevPhoto(): void {
    if (this.zoomPhotoIndex > 0) {
      this.zoomPhotoIndex--;
      this.resetZoomTransform();
    }
  }

  zoomNextPhoto(): void {
    const total = this.getDisplayPhotos().length;
    if (this.zoomPhotoIndex < total - 1) {
      this.zoomPhotoIndex++;
      this.resetZoomTransform();
    }
  }

  private resetZoomTransform(): void {
    this.zoomScale = 1;
    this.zoomPanX = 0;
    this.zoomPanY = 0;
    this.zoomTouchState.mode = 'none';
  }

  onZoomTouchStart(event: TouchEvent): void {
    if (!this.zoomViewerOpen) return;
    const touches = event.touches;

    if (touches.length === 2) {
      this.zoomTouchState.mode = 'pinch';
      this.zoomTouchState.startDistance = this.getTouchDistance(touches);
      this.zoomTouchState.startScale = this.zoomScale;
      return;
    }

    if (touches.length === 1) {
      const now = Date.now();
      if (now - this.zoomTouchState.lastTap < 280) {
        this.handleZoomDoubleTap();
        this.zoomTouchState.lastTap = 0;
        return;
      }
      this.zoomTouchState.lastTap = now;
      this.zoomTouchState.startX = touches[0].clientX;
      this.zoomTouchState.startY = touches[0].clientY;
      this.zoomTouchState.startPanX = this.zoomPanX;
      this.zoomTouchState.startPanY = this.zoomPanY;
      this.zoomTouchState.mode = this.zoomScale > 1 ? 'pan' : 'swipe';
    }
  }

  onZoomTouchMove(event: TouchEvent): void {
    if (!this.zoomViewerOpen) return;
    const touches = event.touches;

    if (this.zoomTouchState.mode === 'pinch' && touches.length === 2) {
      event.preventDefault();
      const distance = this.getTouchDistance(touches);
      if (this.zoomTouchState.startDistance > 0) {
        const nextScale = this.zoomTouchState.startScale * (distance / this.zoomTouchState.startDistance);
        this.zoomScale = Math.min(4, Math.max(1, nextScale));
        if (this.zoomScale <= 1.02) {
          this.resetZoomTransform();
        }
      }
      this.cd.markForCheck();
      return;
    }

    if (this.zoomTouchState.mode === 'pan' && touches.length === 1) {
      event.preventDefault();
      this.zoomPanX = this.zoomTouchState.startPanX + (touches[0].clientX - this.zoomTouchState.startX);
      this.zoomPanY = this.zoomTouchState.startPanY + (touches[0].clientY - this.zoomTouchState.startY);
      this.cd.markForCheck();
    }
  }

  onZoomTouchEnd(event: TouchEvent): void {
    if (!this.zoomViewerOpen) return;

    if (this.zoomTouchState.mode === 'swipe' && event.changedTouches.length === 1 && this.zoomScale <= 1) {
      const dx = event.changedTouches[0].clientX - this.zoomTouchState.startX;
      const dy = event.changedTouches[0].clientY - this.zoomTouchState.startY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        if (dx < 0) {
          this.zoomNextPhoto();
        } else {
          this.zoomPrevPhoto();
        }
      }
    }

    this.zoomTouchState.mode = 'none';
  }

  private handleZoomDoubleTap(): void {
    if (this.zoomScale > 1) {
      this.resetZoomTransform();
    } else {
      this.zoomScale = 2.5;
    }
    this.cd.markForCheck();
  }

  private getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  getDisplayPhotos(): { photoUrl: string }[] {
    const photos = this.property?.photos;
    if (photos?.length) {
      return photos;
    }
    return [{ photoUrl: 'assets/placeholder.jpg' }];
  }

  getZoomPhotoUrl(index = this.zoomPhotoIndex): string {
    const photos = this.getDisplayPhotos();
    const safeIndex = Math.max(0, Math.min(index, photos.length - 1));
    return photos[safeIndex]?.photoUrl ?? 'assets/placeholder.jpg';
  }

  onGalleryScroll(): void {
    if (!this.isBrowser || !this.galleryScroll) return;
    if (this.scrollRaf !== null) {
      cancelAnimationFrame(this.scrollRaf);
    }
    this.scrollRaf = requestAnimationFrame(() => {
      const el = this.galleryScroll?.nativeElement;
      if (!el || el.clientWidth === 0) return;
      const index = Math.round(el.scrollLeft / el.clientWidth);
      const clamped = Math.max(0, Math.min(index, this.getDisplayPhotos().length - 1));
      if (clamped !== this.activePhotoIndex) {
        this.activePhotoIndex = clamped;
        this.scrollActiveThumbIntoView();
        this.cd.markForCheck();
      }
    });
  }

  scrollToPhoto(index: number): void {
    this.activePhotoIndex = index;
    this.syncGalleryToIndex(index, true);
    this.scrollActiveThumbIntoView();
  }

  private scrollActiveThumbIntoView(): void {
    if (!this.isBrowser) return;
    const strip = this.thumbStrip?.nativeElement;
    if (!strip) return;
    const activeThumb = strip.querySelector<HTMLElement>(
      `[data-thumb-index="${this.activePhotoIndex}"]`
    );
    if (!activeThumb) return;
    const targetLeft =
      activeThumb.offsetLeft - strip.clientWidth / 2 + activeThumb.clientWidth / 2;
    strip.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
  }

  private syncGalleryToIndex(index: number, smooth: boolean): void {
    const el = this.galleryScroll?.nativeElement;
    if (!el || el.clientWidth === 0) return;
    el.scrollTo({
      left: index * el.clientWidth,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }

  nextPhoto(event: Event) {
    event.stopPropagation();
    const total = this.getDisplayPhotos().length;
    if (total > 1) {
      const next = (this.activePhotoIndex + 1) % total;
      this.scrollToPhoto(next);
    }
  }

  prevPhoto(event: Event) {
    event.stopPropagation();
    const total = this.getDisplayPhotos().length;
    if (total > 1) {
      const prev = (this.activePhotoIndex - 1 + total) % total;
      this.scrollToPhoto(prev);
    }
  }

  setActivePhoto(index: number) {
    this.scrollToPhoto(index);
  }

  isUserLoggedIn(): boolean {
    if (!this.isBrowser) return false;
    const hasToken = !!localStorage.getItem('token') || !!localStorage.getItem('user');
    if (hasToken) return true;

    const isVerified = localStorage.getItem('userVerifiedWithOtp'); 
    const loginTime = localStorage.getItem('loginTimestamp'); 
    
    if (isVerified === 'true' && loginTime) {
      const ONE_DAY = 1 * 24 * 60 * 60 * 1000;
      const timeElapsed = Date.now() - parseInt(loginTime, 10);
      return timeElapsed < ONE_DAY;
    }
    return false;
  }
  
  isOwnerLoggedIn(): boolean {
    if (!this.isBrowser) return false;
    const hasToken = !!localStorage.getItem('token') || !!localStorage.getItem('user');
    if (hasToken) return true;

    const isVerified = localStorage.getItem('userVerifiedWithOtp'); 
    const loginTime = localStorage.getItem('loginTimestamp');
    
    if (isVerified === 'true' && loginTime) {
      const TEN_DAYS = 10 * 24 * 60 * 60 * 1000;
      const timeElapsed = Date.now() - parseInt(loginTime, 10);
      return timeElapsed < TEN_DAYS;
    }
    return false;
  }
  
  checkReturnFromLogin() {
    const params = this.route.snapshot.queryParams;
    const paymentStatus = params['payment'];
    const notice = paymentReturnNotice(paymentStatus);
    if (notice) this.toastr[notice.level](notice.message);

    const loggedIn = this.isUserLoggedIn() || this.isOwnerLoggedIn();
    // Returning from a payment that did not go through must not replay the
    // action that opened the paywall, otherwise the plan sheet pops straight
    // back up on a page the user was trying to get back to.
    const paymentBlocked = paymentStatus === 'failed' || paymentStatus === 'cancelled';
    const canResumeContact = loggedIn && !paymentBlocked;

    if (params['showContact'] === 'true' && canResumeContact) {
      this.openContactModal();
      this.clearQueryParams();
    } else if (params['action'] === 'report' && loggedIn) {
      this.openReportModal(); 
      this.clearQueryParams();
    } else if ((params['action'] === 'call' || params['action'] === 'whatsapp') && canResumeContact) {
      this.handleContactAction(params['action'] as 'call' | 'whatsapp');
      this.clearQueryParams();
    } else if (notice || params['showContact'] || params['action']) {
      this.clearQueryParams();
    }
  }

  private clearQueryParams() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { showContact: null, action: null, payment: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private resetOwnerDetails(): void {
    this.ownerDetails = {
      name: 'Property Owner',
      ownerPhone: '',
      propertyPhone: '',
      email: ''
    };
  }

  private syncContactFromProperty(): void {
    if (!this.property || !this.contactUnlocked) return;
    const phone = this.property.contactNo ?? this.property.tempContactNo;
    if (phone != null && String(phone).trim() !== '') {
      this.ownerDetails.propertyPhone = String(phone);
    }
  }

  private hasContactPhone(): boolean {
    return !!(this.ownerDetails.propertyPhone || this.ownerDetails.ownerPhone);
  }

  private hasOwnerEmail(): boolean {
    const email = (this.ownerDetails.email || '').trim();
    return !!email && email !== 'hidden@roomzo.com';
  }

  private applyOwnerDetails(data: any): void {
    if (!this.contactUnlocked && !data?.unlocked) {
      this.ownerDetails = {
        name: data.name || this.ownerName || 'Property Owner',
        ownerPhone: '',
        propertyPhone: '',
        email: '',
      };
      return;
    }
    const listingPhone = this.contactUnlocked
      ? (this.property?.contactNo ?? this.property?.tempContactNo)
      : null;
    const propertyPhone = listingPhone != null && String(listingPhone).trim() !== ''
      ? String(listingPhone)
      : (data.phone ? String(data.phone) : '');

    this.ownerDetails = {
      name: data.name || this.ownerName || 'Property Owner',
      ownerPhone: data.phone ? String(data.phone) : '',
      propertyPhone,
      email: data.email || ''
    };
  }

  closeContactModal() {
    this.showContactModal = false;
  }

  openImage(url: string | undefined): void {
    if (url && this.isBrowser) {
      window.open(url, '_blank');
    }
  }

  loadMapCoordinates(property: any) {
    if (property.latitude && property.longitude) {
      const lat = property.latitude;
      const lon = property.longitude;
      const offset = 0.02; 
      const bbox = `${Number(lon)-offset},${Number(lat)-offset},${Number(lon)+offset},${Number(lat)+offset}`;
      const rawUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
      
      this.mapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(rawUrl);
      this.cd.detectChanges();
      return; 
    }

    if (property.city && property.state) {
      this.propertyService.getGeocode(property.city, property.state).subscribe({
        next: (results: any[]) => {
          if (results && results.length > 0) {
            const location = results[0];
            const lat = location.lat;
            const lon = location.lon;
            const offset = 0.02; 
            const bbox = `${Number(lon)-offset},${Number(lat)-offset},${Number(lon)+offset},${Number(lat)+offset}`;
            const rawUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
            
            this.mapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(rawUrl);
            this.cd.detectChanges();
          }
        },
        error: () => this.toastr.warning('Could not load map location', 'Map Error')
      });
    }
  }

  shareProperty() {
    if (this.isBrowser && navigator.clipboard) {
      if (this.property?.id) {
        this.activityService.logPropertyShare(this.property.id, {
          ownerId: this.property.ownerId
        });
      }
      const currentUrl = window.location.href;
      if (navigator.share) {
        navigator.share({
          title: this.property ? `${this.property.propertyType} in ${this.property.city}` : 'Check out this property',
          text: this.property ? `${this.property.propertyType} in ${this.property.city} — ${this.formatPrice(this.property.rentAmount)}/mo` : 'Check out this rental listing',
          url: currentUrl,
        }).catch((err) => {
          if (err?.name !== 'AbortError') {
            this.toastr.error('Sharing failed', 'Error');
          }
        });
      } else {
        navigator.clipboard.writeText(currentUrl).then(() => {
          this.isCopied = true;
          this.toastr.success('Link copied to clipboard!', 'Shared');
          setTimeout(() => {
            this.isCopied = false;
            this.cd.detectChanges();
          }, 2000);
          this.cd.detectChanges();
        }).catch(() => {
          this.toastr.error('Failed to copy link', 'Error');
        });
      }
    }
  }

  scheduleTour() { this.toastr.info('Tour scheduling feature coming soon!', 'Coming Soon'); }

  ngOnDestroy(): void {
    this.seo.removeJsonLd();
    if (this.scrollRaf !== null) {
      cancelAnimationFrame(this.scrollRaf);
    }
    if (this.isBrowser) {
      this.renderer.removeClass(this.document.body, 'hide-global-bottom-nav');
      this.renderer.removeClass(this.document.body, 'immersive-detail-page');
      this.renderer.removeClass(this.document.body, 'zoom-viewer-open');
    }
    if (this.routeSub) this.routeSub.unsubscribe();
  }
  
  loadSuggestions(property: any) {
    if (!property) return;
    const currentId = String(property.id);
    const targetCount = 6;

    const finish = (listings: any[]) => {
      const filtered = listings.filter((p: any) => String(p.id) !== currentId);
      this.similarProperties = filtered.slice(0, targetCount);
      this.cd.detectChanges();
    };

    if (!property.latitude || !property.longitude) {
      finish([]);
      return;
    }

    this.propertyService
      .searchListingsWithFilters(0, 12, {
        lat: property.latitude,
        lng: property.longitude,
        sortBy: 'nearest',
      }, false)
      .subscribe({
        next: (res: any) => finish(res?.listings ?? []),
        error: () => finish([]),
      });
  }

  private mergeUniqueListings(...groups: any[][]): any[] {
    const seen = new Set<string>();
    const merged: any[] = [];
    for (const group of groups) {
      for (const item of group) {
        const id = String(item?.id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        merged.push(item);
      }
    }
    return merged;
  }

  mapAmenities(propData: any) {
    if (!propData) return;
    const config = getAmenitiesMap();
    this.displayAmenities = config.filter(
      (c) => propData[c.dbKey] === true || propData[c.dbKey] === 1
    );
  }

  mapConditions(propData: any) {
    if (!propData) return;
    const config = getListingConditionsMap();
    this.displayConditions = config.filter(
      (c) => propData[c.dbKey] === true || propData[c.dbKey] === 1
    );
  }

  loadReviews(listingId: number | string): void {
    this.isLoadingReviews = true;
    this.propertyService.getListingReviews(listingId).subscribe({
      next: (res: any) => {
        this.isLoadingReviews = false;
        if (res.status === 1) {
          this.reviews = res.reviews || [];
          this.avgRating = res.avgRating ? Number(res.avgRating) : 0;
          this.reviewCount = res.reviewCount || 0;
          if (this.property) {
            this.property.avgRating = this.avgRating;
            this.property.reviewCount = this.reviewCount;
          }
        }
        this.cd.detectChanges();
      },
      error: () => {
        this.isLoadingReviews = false;
        this.cd.detectChanges();
      }
    });
  }

  setReviewRating(value: number): void {
    this.reviewRating = value;
  }

  submitReview(): void {
    if (!this.isUserLoggedIn() && !this.isOwnerLoggedIn()) {
      const returnUrl = `/room/${this.currentId}`;
      this.router.navigate(['/owner-auth'], { queryParams: { returnUrl } });
      return;
    }

    const user = this.getLoggedInUser();
    if (!user?.id) {
      this.toastr.error('Please log in to leave a review');
      return;
    }

    if (this.property?.ownerId && Number(user.id) === Number(this.property.ownerId)) {
      this.toastr.warning('You cannot review your own listing');
      return;
    }

    if (!this.reviewRating || this.reviewRating < 1) {
      this.toastr.warning('Please select a rating');
      return;
    }

    this.isSubmittingReview = true;
    this.propertyService.submitListingReview(this.currentId!, {
      userId: user.id,
      rating: this.reviewRating,
      comment: this.reviewComment?.trim() || undefined
    }).subscribe({
      next: (res: any) => {
        this.isSubmittingReview = false;
        if (res.status === 1) {
          this.toastr.success('Review submitted!');
          this.reviewComment = '';
          this.loadReviews(this.currentId!);
        } else {
          this.toastr.error(res.message || 'Could not submit review');
        }
        this.cd.detectChanges();
      },
      error: () => {
        this.isSubmittingReview = false;
        this.toastr.error('Failed to submit review');
        this.cd.detectChanges();
      }
    });
  }

  getStarArray(rating: number): number[] {
    return [1, 2, 3, 4, 5];
  }

  private getLoggedInUser(): { id: number } | null {
    if (!this.isBrowser) return null;
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  formatReviewDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  isPropertyRented(): boolean {
    return Number(this.property?.isRented) === 1;
  }

  isContactAvailable(): boolean {
    return !!this.property && Number(this.property.isRented) === 0;
  }

  getAvailabilityLabel(): string {
    const status = Number(this.property?.isRented);
    if (status === 1) return 'Currently Rented';
    if (status === 3) return 'Expired';
    return 'Available Now';
  }

  formatPrice(price: number): string {
    return '₹' + (price ? price.toLocaleString() : '0');
  }

  openGoogleMaps(): void {
    if (!this.property) return;
    let destination = '';

    if (this.property.latitude && this.property.longitude) {
      destination = `${this.property.latitude},${this.property.longitude}`;
    } 
    else if (this.property.city || this.property.street) {
      const addressParts = [
        this.property.street,
        this.property.landmark,
        this.property.city,
        this.property.state,
        this.property.zipCode
      ];
      destination = encodeURIComponent(
        addressParts.filter(part => part && String(part).trim() !== '').join(', ')
      );
    }

    if (destination) {
      if (this.isBrowser) {
        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${destination}`;
        window.open(googleMapsUrl, '_blank');
      }
    } else {
      this.toastr.warning('Location details are not available for this property.', 'Location Unavailable');
    }
  }

  reportProperty() {
    if (this.isUserLoggedIn() || this.isOwnerLoggedIn()) {
      this.openReportModal(); 
    } else {
      const returnUrl = `/room/${this.currentId}?action=report`;
      this.router.navigate(['/owner-auth'], { queryParams: { returnUrl: returnUrl } });
    }
  }

  submitReport() {
    if (!this.reportReason) {
      this.toastr.warning('Please select a reason for reporting.', 'Missing Info');
      return;
    }

    const finalReason = this.reportReason + (this.reportDescription ? ` - Details: ${this.reportDescription}` : '');

    const payload = {
      propertyId: this.currentId,
      propertyName: `${this.property?.propertyType} in ${this.property?.city}`,
      ownerId: this.property?.ownerId,
      reason: finalReason,
      reporterEmail: localStorage.getItem('userEmail') || 'Unknown User' 
    };

    this.propertyService.reportProperty(payload).subscribe({
      next: (res: any) => {
        if (res.status === 1) {
          this.toastr.success('Property reported successfully. Our team will look into it.', 'Reported');
          this.closeReportModal(); 
        } else {
          this.toastr.error('Could not submit report.', 'Error');
        }
      },
      error: (err) => {
        console.error('Report error:', err);
        this.toastr.error('Failed to report property.', 'Server Error');
      }
    });
  }

  openReportModal() {
    this.reportReason = '';
    this.reportDescription = '';
    this.showReportModal = true;
  }

  closeReportModal() {
    this.showReportModal = false;
  }

  get formattedDescription(): string[] {
    if (!this.property || !this.property.description) return [];
    
    return this.property.description
      .split('|')
      .map((item: string) => item.trim())
      .filter((item: string) => item.length > 0);
  }

  private applyPropertySeo(property: any): void {
    const title = `${property.propertyType} for Rent in ${property.city} — ₹${property.rentAmount?.toLocaleString('en-IN') ?? '0'}/mo | Roomzo`;
    const description = (
      property.description?.replace(/\|/g, ' ').slice(0, 155) ||
      `Verified ${property.propertyType} for rent in ${property.street}, ${property.city}. Broker-free listing with direct owner contact on Roomzo.`
    );
    const ogImage = property.photos?.[0]?.photoUrl;

    this.breadcrumbItems = [
      { label: 'Home', path: '/' },
      { label: 'Explore', path: '/explore-listing' },
      { label: property.city, path: `/city/${slugifyCity(property.city)}` },
      { label: `${property.propertyType} in ${property.street || property.city}` },
    ];

    this.seo.applyPageSeo({
      title,
      description,
      path: this.seo.buildRoomPath(property.id),
      keywords: [
        `${property.propertyType?.toLowerCase()} for rent ${property.city?.toLowerCase()}`,
        'room for rent',
        'brokerless property',
        'student housing',
        `pg in ${property.city?.toLowerCase()}`,
      ],
      ogImage,
      ogType: 'product',
      jsonLd: [
        this.seo.buildListingJsonLd(property),
        this.seo.buildBreadcrumbJsonLd(this.breadcrumbItems),
      ],
    });
  }
  
  highlightContact = false;
  checkFocusContact() {
    const params = this.route.snapshot.queryParams;
    if (params['focusContact'] === 'true') {
      this.highlightContact = true;
      this.cd.detectChanges();
      
      if (this.isBrowser) {
        setTimeout(() => {
          const targetBtn = document.querySelector('.booking-card .btn-primary');
          if (targetBtn) {
            targetBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          
          setTimeout(() => {
            this.highlightContact = false;
            this.cd.detectChanges();
            
            this.router.navigate([], {
              relativeTo: this.route,
              queryParams: { focusContact: null },
              queryParamsHandling: 'merge',
              replaceUrl: true
            });
          }, 3000);
        }, 300); 
      }
    }
  }
}