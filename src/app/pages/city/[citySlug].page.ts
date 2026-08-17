import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID, signal, OnDestroy, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser, Location } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { PropertyService } from '../../services/property.service';
import { AuthService } from '../../services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { SafetyConsentBottomSheetComponent, PendingAction } from '../../components/safety-consent/safety-consent';
import { SeoService } from '../../services/seo.service';
import {
  getCityBySlug,
  getCityKeywords,
  getCitySeoDescription,
  getCitySeoTitle,
  RoomzoCity,
} from '../../config/cities.config';
import { RelatedSearchesComponent } from '../../components/related-searches/related-searches';
import { SeoBreadcrumbComponent } from '../../components/seo-breadcrumb/seo-breadcrumb';
import { ContentGuideComponent } from '../../components/content-guide/content-guide';
import { PropertyMediaCarouselComponent } from '../../components/property-media-carousel/property-media-carousel';
import { ContactAccessService } from '../../services/contact-access.service';
import { paymentReturnNotice } from '../../utils/billing-return';
import { CityGuide, getCityGuide } from '../../content/city-guides';
import {
  generatePropertyAltText,
  getListingImageUrl,
  optimizeImageUrl,
} from '../../utils/image-seo.util';

// Import the JSON data for city zones
import cityZonesData from '../../../../public/data/city-zones.json';

@Component({
  selector: 'app-city-listings',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    SafetyConsentBottomSheetComponent,
    RelatedSearchesComponent,
    SeoBreadcrumbComponent,
    ContentGuideComponent,
    PropertyMediaCarouselComponent,
  ],
  templateUrl: '../explore-city/explore-city.html',
  styleUrls: ['../explore-city/explore-city.css'],
})
export default class CityListingsPage implements OnInit, OnDestroy {
  city = '';
  state = '';
  cityConfig?: RoomzoCity;

  listings: any[] = [];
  isLoading = false;
  isLoadingMore = false;
  sortBy = 'latest';
  isSortMenuOpen = false;
  currentPage = 0;
  pageSize = 12;
  totalPages = 0;
  totalItems = 0;
  isFilterMenuOpen: boolean = false;
  // --- NEW: Filter State Variables ---
  selectedZone: string | null = null;
  cityZones: any[] = [];
  
  selectedPropertyType: string | null = null;
  propertyTypes = [
    { label: 'All Spaces', value: null, icon: 'apps' },
    { label: 'Flats', value: 'Flat', icon: 'apartment' },
    { label: 'PGs', value: 'PG', icon: 'group' },
    { label: 'Rooms', value: 'Room', icon: 'meeting_room' }
  ];

  userHasGivenConsent = signal(false);
  isConsentModalOpen = signal(false);
  pendingAction = signal<PendingAction | any>(null);

  readonly generatePropertyAltText = generatePropertyAltText;
  readonly getListingImageUrl = getListingImageUrl;
  readonly optimizeImageUrl = optimizeImageUrl;

  breadcrumbItems: { label: string; path?: string }[] = [];
  cityGuide: CityGuide | null = null;

  constructor(
    private propertyService: PropertyService,
    private route: ActivatedRoute,
    private router: Router,
    private cd: ChangeDetectorRef,
    private location: Location,
    private authService: AuthService,
    private toastr: ToastrService,
    private seo: SeoService,
    private contactAccess: ContactAccessService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('citySlug') ?? '';
      this.cityConfig = getCityBySlug(slug);

      if (!this.cityConfig) {
        this.router.navigate(['/explore-listing'], { replaceUrl: true });
        return;
      }

      this.city = this.cityConfig.name;
      this.state = this.cityConfig.state;
      this.cityGuide = getCityGuide(this.cityConfig.slug);
      this.breadcrumbItems = [
        { label: 'Home', path: '/' },
        { label: 'Explore', path: '/explore-listing' },
        { label: this.city },
      ];

      this.applyCitySeo();
      
      // Load zones for the current city and reset filters
      this.loadCityZones(this.city);
      
      // 2. Apply zone + propertyType from URL (related searches / deep links)
      this.route.queryParams.subscribe(queryParams => {
        const requestedZone = queryParams['zone'];
        
        if (requestedZone && this.cityZones && this.cityZones.length > 0) {
          const matchedZone = this.cityZones.find(z => 
            z.name.toLowerCase() === requestedZone.toLowerCase()
          );
          this.selectedZone = matchedZone ? matchedZone.name : null;
        } else {
          this.selectedZone = null;
        }

        const requestedType = queryParams['propertyType'];
        const allowedTypes = ['Room', 'PG', 'Flat'];
        if (requestedType && allowedTypes.includes(requestedType)) {
          this.selectedPropertyType = requestedType;
        } else {
          this.selectedPropertyType = null;
        }

        this.listings = [];
        this.currentPage = 0;
        this.loadCityData();
      });

   
    });

    this.checkReturnFromLogin();
  }

  ngOnDestroy(): void {
    this.seo.removeJsonLd();
  }

  // --- NEW: Load Zones from JSON ---
  private loadCityZones(cityName: string) {
    const allZones: any = cityZonesData; 
    this.cityZones = allZones[cityName] || [];
  }

  // --- NEW: Filter Actions ---
  selectZone(zoneName: string | null) {
    if (this.selectedZone === zoneName) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        zone: zoneName || null,
        propertyType: this.selectedPropertyType || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  selectPropertyType(typeValue: string | null) {
    if (this.selectedPropertyType === typeValue) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        zone: this.selectedZone || null,
        propertyType: typeValue || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private resetAndLoadData() {
    this.currentPage = 0;
    this.listings = [];
    this.loadCityData();
  }

  private applyCitySeo(): void {
    if (!this.cityConfig) return;

    const title = getCitySeoTitle(this.cityConfig);
    const description = getCitySeoDescription(this.cityConfig);

    this.seo.applyPageSeo({
      title,
      description,
      path: `/city/${this.cityConfig.slug}`,
      keywords: getCityKeywords(this.cityConfig),
      ogImage: this.getCityHeaderImage(),
      jsonLd: [
        this.seo.buildCityCollectionJsonLd(this.cityConfig),
        this.seo.buildBreadcrumbJsonLd(this.breadcrumbItems),
      ],
    });
  }

  private refreshListSchema(): void {
    if (!this.cityConfig || this.listings.length === 0) return;
    this.seo.setJsonLd([
      this.seo.buildCityCollectionJsonLd(this.cityConfig),
      this.seo.buildBreadcrumbJsonLd(this.breadcrumbItems),
      this.seo.buildItemListJsonLd(
        this.listings,
        `Rooms for rent in ${this.city}`
      ),
    ]);
  }

  // --- UPDATED: Pass Filters to Service ---
  loadCityData(isLoadMore = false): void {
    if (isLoadMore) {
      this.isLoadingMore = true;
    } else {
      this.isLoading = true;
    }
    this.cd.detectChanges();

    this.propertyService
      .exploreByExactCity(
        this.city, 
        this.state, 
        this.selectedZone, 
        this.selectedPropertyType, 
        this.sortBy, 
        this.currentPage, 
        this.pageSize
      )
      .subscribe({
        next: (response: any) => {
          if (response?.listings) {
            if (isLoadMore) {
              this.listings = [...this.listings, ...response.listings];
            } else {
              this.listings = response.listings;
            }
            this.totalPages = response.totalPages || 0;
            this.totalItems = response.totalItems || 0;
            if (!isLoadMore) {
              this.refreshListSchema();
            }
          }
          this.isLoading = false;
          this.isLoadingMore = false;
          this.cd.detectChanges();
        },
        error: () => {
          this.isLoading = false;
          this.isLoadingMore = false;
          this.cd.detectChanges();
        },
      });
  }

  loadMore(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.loadCityData(true);
    }
  }
toggleMobileFilters(event: Event): void {
    event?.preventDefault(); // Stop default button behavior
    event?.stopPropagation(); // Prevent the body click listener from catching this
    
    this.isFilterMenuOpen = !this.isFilterMenuOpen;
    this.cd.detectChanges(); // CRITICAL: Forces Angular to update the UI instantly
  }
  toggleSortMenu(event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    this.isSortMenuOpen = !this.isSortMenuOpen;
    this.cd.detectChanges();
  }

  applySort(newSort: string, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    this.sortBy = newSort;
    this.isSortMenuOpen = false;
    this.resetAndLoadData();
  }

  getSortLabel(): string {
    switch (this.sortBy) {
      case 'latest':
        return 'Newest First';
      case 'oldest':
        return 'Oldest First';
      case 'price_low':
        return 'Price: Low to High';
      case 'price_high':
        return 'Price: High to Low';
      default:
        return 'Sort';
    }
  }

  goBack() {
    this.location.back();
  }

  viewDetails(id: string) {
    this.router.navigate(['/room', id]);
  }

  formatPrice(price: number): string {
    return '₹' + (price ? price.toLocaleString('en-IN') : '0');
  }

  formatPostedDate(dateString?: string): string {
    if (!dateString) return 'Recently';
    const date = new Date(dateString);
    const diff = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff} days ago`;
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  }

  getCityHeaderImage(): string {
    return this.cityConfig?.heroImage ?? 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1600&q=80';
  }

  scrollToContact(id: string): void {
    this.router.navigate(['/room', id], { queryParams: { focusContact: 'true' } });
  }

  checkReturnFromLogin() {
    const notice = paymentReturnNotice(this.route.snapshot.queryParamMap.get('payment'));
    if (notice) {
      this.toastr[notice.level](notice.message);
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { payment: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
    if (isPlatformBrowser(this.platformId) && (this.isUserLoggedIn() || this.isOwnerLoggedIn())) {
      const pending = localStorage.getItem('pendingAction');
      if (pending) {
        try {
          const parsed = JSON.parse(pending);
          localStorage.removeItem('pendingAction');
          this.propertyService.getListingById(parsed.propertyId).subscribe({
            next: (res: any) => {
              if (res.status === 1 && res.data) {
                this.handleCardContactAction(res.data, parsed.action);
              }
            },
          });
        } catch {
          localStorage.removeItem('pendingAction');
        }
      }
    }
  }

  handleCardContactAction(prop: any, actionType: 'call' | 'whatsapp') {
    if (this.isUserLoggedIn() || this.isOwnerLoggedIn()) {
      this.checkAndExecuteConsent({ prop, actionType }, () => {
        this.executeContactAction(prop, actionType);
      });
    } else {
      localStorage.setItem('pendingAction', JSON.stringify({ action: actionType, propertyId: prop.id }));
      this.router.navigate(['/owner-auth'], { queryParams: { returnUrl: this.router.url } });
    }
  }

  private executeContactAction(prop: any, actionType: 'call' | 'whatsapp') {
    this.contactAccess.requestOwnerContact(Number(prop.id), this.router.url).subscribe((result) => {
      const phone = result?.contact?.propertyPhone || result?.contact?.phone || result?.contact?.ownerPhone;
      if (!phone) {
        if (result) this.toastr.error('Contact number not available');
        return;
      }
      this.propertyService.triggerPhoneAndWP(phone, actionType, prop);
    });
  }

  private checkAndExecuteConsent(actionData: any, successCallback: () => void) {
    if (
      this.userHasGivenConsent() ||
      (isPlatformBrowser(this.platformId) && localStorage.getItem('safetyConsentGiven') === 'true')
    ) {
      this.userHasGivenConsent.set(true);
      successCallback();
      return;
    }

    let userId: number | null = null;
    if (isPlatformBrowser(this.platformId)) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          userId = JSON.parse(storedUser).id;
        } catch {}
      }
    }

    if (userId) {
      this.propertyService.checkSafetyConsent(userId).subscribe({
        next: (res: any) => {
          if (res.status === 1 && res.hasConsent) {
            if (isPlatformBrowser(this.platformId)) localStorage.setItem('safetyConsentGiven', 'true');
            this.userHasGivenConsent.set(true);
            successCallback();
          } else {
            this.pendingAction.set(actionData);
            this.isConsentModalOpen.set(true);
            this.cd.detectChanges();
          }
        },
        error: () => {
          this.pendingAction.set(actionData);
          this.isConsentModalOpen.set(true);
          this.cd.detectChanges();
        },
      });
    } else {
      this.pendingAction.set(actionData);
      this.isConsentModalOpen.set(true);
      this.cd.detectChanges();
    }
  }

  onConsentAccepted(action: any) {
    let userId: number | null = null;
    if (isPlatformBrowser(this.platformId)) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          userId = JSON.parse(storedUser).id;
        } catch {}
      }
    }

    const proceed = () => this.executeContactAction(action.prop, action.actionType);

    if (userId) {
      this.propertyService.updateSafetyConsent(userId, true).subscribe({
        next: (res: any) => {
          if (res.status === 1) {
            this.userHasGivenConsent.set(true);
            if (isPlatformBrowser(this.platformId)) localStorage.setItem('safetyConsentGiven', 'true');
            proceed();
          } else {
            this.toastr.error('Failed to record consent.');
          }
        },
        error: () => this.toastr.error('Server error while recording consent.'),
      });
    } else {
      this.userHasGivenConsent.set(true);
      if (isPlatformBrowser(this.platformId)) localStorage.setItem('safetyConsentGiven', 'true');
      proceed();
    }
  }

  isUserLoggedIn(): boolean {
    return !!(localStorage.getItem('token') || localStorage.getItem('user'));
  }

  isOwnerLoggedIn(): boolean {
    return this.isUserLoggedIn();
  }

  // --- NEW: Global click listener to close menus ---
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.isSortMenuOpen) {
      this.isSortMenuOpen = false;
      this.cd.detectChanges();
    }
  }
}