import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID, signal, OnDestroy, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser, Location } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, combineLatest, of } from 'rxjs';
import { distinctUntilChanged, map, switchMap } from 'rxjs/operators';
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
import { ListingCardComponent } from '../../components/listing-card/listing-card';
import { ContactAccessService } from '../../services/contact-access.service';
import { paymentReturnNotice } from '../../utils/billing-return';
import { CityGuide, getCityGuide } from '../../content/city-guides';
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
    ListingCardComponent,
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
  contactLoadingId: number | null = null;
  private paywallOpenedSub: Subscription | null = null;
  private routeSub: Subscription | null = null;
  private listingsSub: Subscription | null = null;
  /** When true, next query-param emission was caused by our own navigate (avoid double fetch). */
  private skipNextQueryLoad = false;

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
    this.routeSub = combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(
        map(([params, query]) => ({
          slug: params.get('citySlug') ?? '',
          zone: query.get('zone'),
          propertyType: query.get('propertyType'),
          sortBy: query.get('sortBy'),
        })),
        distinctUntilChanged(
          (a, b) =>
            a.slug === b.slug &&
            a.zone === b.zone &&
            a.propertyType === b.propertyType &&
            a.sortBy === b.sortBy
        ),
        switchMap((routeState) => {
          this.cityConfig = getCityBySlug(routeState.slug);
          if (!this.cityConfig) {
            this.router.navigate(['/explore-listing'], { replaceUrl: true });
            return of(null);
          }

          const cityChanged = this.city !== this.cityConfig.name;
          this.city = this.cityConfig.name;
          this.state = this.cityConfig.state;
          this.cityGuide = getCityGuide(this.cityConfig.slug);
          this.breadcrumbItems = [
            { label: 'Home', path: '/' },
            { label: 'Explore', path: '/explore-listing' },
            { label: this.city },
          ];

          if (cityChanged) {
            this.applyCitySeo();
            this.loadCityZones(this.city);
            this.sortBy = 'latest';
            this.selectedZone = null;
            this.selectedPropertyType = null;
          }

          this.applyFiltersFromRoute(routeState.zone, routeState.propertyType, routeState.sortBy);

          if (this.skipNextQueryLoad) {
            this.skipNextQueryLoad = false;
            return of(null);
          }

          this.listings = [];
          this.currentPage = 0;
          return of('load');
        })
      )
      .subscribe((action) => {
        if (action === 'load') {
          this.loadCityData();
        }
      });

    this.checkReturnFromLogin();
    this.paywallOpenedSub = this.contactAccess.paywallOpened$.subscribe(() => {
      this.setContactLoading(null);
    });
  }

  ngOnDestroy(): void {
    this.seo.removeJsonLd();
    this.paywallOpenedSub?.unsubscribe();
    this.routeSub?.unsubscribe();
    this.listingsSub?.unsubscribe();
  }

  private applyFiltersFromRoute(
    requestedZone: string | null,
    requestedType: string | null,
    requestedSort: string | null
  ): void {
    if (requestedZone && this.cityZones?.length) {
      const matchedZone = this.cityZones.find(
        (z) => z.name.toLowerCase() === requestedZone.toLowerCase()
      );
      this.selectedZone = matchedZone ? matchedZone.name : null;
    } else if (requestedZone) {
      this.selectedZone = requestedZone;
    } else {
      this.selectedZone = null;
    }

    const allowedTypes = ['Room', 'PG', 'Flat'];
    if (requestedType && allowedTypes.includes(requestedType)) {
      this.selectedPropertyType = requestedType;
    } else {
      this.selectedPropertyType = null;
    }

    const allowedSorts = ['latest', 'oldest', 'price_low', 'price_high'];
    if (requestedSort && allowedSorts.includes(requestedSort)) {
      this.sortBy = requestedSort;
    } else if (!requestedSort) {
      // Keep current sort unless URL explicitly clears it via absence after sync
      // Default remains latest on first load.
    }
  }

  // --- NEW: Load Zones from JSON ---
  private loadCityZones(cityName: string) {
    const allZones: any = cityZonesData; 
    this.cityZones = allZones[cityName] || [];
  }

  // --- Filter Actions: update state + reload immediately, then sync URL ---
  selectZone(zoneName: string | null) {
    if (this.selectedZone === zoneName) return;
    this.selectedZone = zoneName;
    this.currentPage = 0;
    this.listings = [];
    this.syncFiltersToUrl();
    this.loadCityData();
  }

  selectPropertyType(typeValue: string | null) {
    if (this.selectedPropertyType === typeValue) {
      if (this.isFilterMenuOpen) {
        this.isFilterMenuOpen = false;
        this.cd.detectChanges();
      }
      return;
    }
    this.selectedPropertyType = typeValue;
    this.isFilterMenuOpen = false;
    this.currentPage = 0;
    this.listings = [];
    this.syncFiltersToUrl();
    this.loadCityData();
  }

  private syncFiltersToUrl(): void {
    const nextZone = this.selectedZone || null;
    const nextType = this.selectedPropertyType || null;
    const nextSort = this.sortBy && this.sortBy !== 'latest' ? this.sortBy : null;
    const q = this.route.snapshot.queryParamMap;
    const same =
      (q.get('zone') || null) === nextZone &&
      (q.get('propertyType') || null) === nextType &&
      (q.get('sortBy') || null) === nextSort;
    if (same) return;

    this.skipNextQueryLoad = true;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        zone: nextZone,
        propertyType: nextType,
        sortBy: nextSort,
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

    this.listingsSub?.unsubscribe();
    this.listingsSub = this.propertyService
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
          } else if (!isLoadMore) {
            this.listings = [];
            this.totalPages = 0;
            this.totalItems = 0;
          }
          this.isLoading = false;
          this.isLoadingMore = false;
          this.cd.detectChanges();
        },
        error: () => {
          if (!isLoadMore) {
            this.listings = [];
          }
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

  toggleMobileFilters(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.isFilterMenuOpen = !this.isFilterMenuOpen;
    if (this.isFilterMenuOpen) {
      this.isSortMenuOpen = false;
    }
    this.cd.detectChanges();
  }

  toggleSortMenu(event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    this.isSortMenuOpen = !this.isSortMenuOpen;
    if (this.isSortMenuOpen) {
      this.isFilterMenuOpen = false;
    }
    this.cd.detectChanges();
  }

  applySort(newSort: string, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.sortBy === newSort) {
      this.isSortMenuOpen = false;
      this.cd.detectChanges();
      return;
    }
    this.sortBy = newSort;
    this.isSortMenuOpen = false;
    this.syncFiltersToUrl();
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

  viewDetails(id: string | number) {
    this.router.navigate(['/room', id]);
  }

  toggleSavedListing(item: any): void {
    const isLoggedIn = this.isUserLoggedIn() || this.isOwnerLoggedIn();
    if (!isLoggedIn) {
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('pendingFavoritePropertyId', String(item.id));
      }
      const shouldNavigate = isPlatformBrowser(this.platformId)
        ? window.confirm('Please log in to save this property. Would you like to go to the login page now?')
        : false;
      if (shouldNavigate) {
        this.router.navigate(['/owner-auth'], { queryParams: { returnUrl: this.router.url } });
      }
      return;
    }

    const nextValue = !item.isFavorite;
    const propertyId = String(item.id);
    item.isFavorite = nextValue;

    const request = nextValue
      ? this.propertyService.saveFavoriteProperty(propertyId)
      : this.propertyService.removeFavoriteProperty(propertyId);

    request.subscribe({
      next: (res: any) => {
        if (res?.status === 1 || res?.status === '1') {
          this.toastr.success(nextValue ? 'Property saved to favorites.' : 'Property removed from favorites.');
        } else {
          item.isFavorite = !nextValue;
          this.toastr.error(res?.message || 'Could not update favorites.');
        }
        this.cd.detectChanges();
      },
      error: () => {
        item.isFavorite = !nextValue;
        this.toastr.error('Could not update favorites.');
        this.cd.detectChanges();
      },
    });
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
    if (this.contactLoadingId != null || this.contactAccess.isPaywallOpen()) return;
    if (this.isUserLoggedIn() || this.isOwnerLoggedIn()) {
      this.setContactLoading(Number(prop.id));
      this.checkAndExecuteConsent({ prop, actionType }, () => {
        this.executeContactAction(prop, actionType);
      });
    } else {
      localStorage.setItem('pendingAction', JSON.stringify({ action: actionType, propertyId: prop.id }));
      this.router.navigate(['/owner-auth'], { queryParams: { returnUrl: this.router.url } });
    }
  }

  private setContactLoading(id: number | null): void {
    if (this.contactLoadingId === id) return;
    this.contactLoadingId = id;
    this.cd.detectChanges();
  }

  private executeContactAction(prop: any, actionType: 'call' | 'whatsapp') {
    this.setContactLoading(Number(prop.id));
    this.contactAccess.requestOwnerContact(Number(prop.id), this.router.url).subscribe({
      next: (result) => {
        this.setContactLoading(null);
        if (!result?.unlocked) return;
        const phone = result?.contact?.propertyPhone || result?.contact?.phone || result?.contact?.ownerPhone;
        if (!phone) {
          if (result) this.toastr.error('Contact number not available');
          return;
        }
        this.propertyService.triggerPhoneAndWP(phone, actionType, prop);
      },
      error: () => this.setContactLoading(null),
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
            this.setContactLoading(null);
            this.pendingAction.set(actionData);
            this.isConsentModalOpen.set(true);
            this.cd.detectChanges();
          }
        },
        error: () => {
          this.setContactLoading(null);
          this.pendingAction.set(actionData);
          this.isConsentModalOpen.set(true);
          this.cd.detectChanges();
        },
      });
    } else {
      this.setContactLoading(null);
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

  // --- Global click listener to close menus ---
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.isSortMenuOpen && !target?.closest('.sort-action-container')) {
      this.isSortMenuOpen = false;
      this.cd.detectChanges();
    }
  }
}