import { Component, OnInit, ChangeDetectorRef, OnDestroy, Inject, PLATFORM_ID, NgZone, Renderer2, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router } from '@angular/router'; 
import { HttpClient } from '@angular/common/http'; 
import { AuthService } from '../../services/auth.service';
import { Subscription, of, forkJoin, Observable } from 'rxjs';
import { finalize, debounceTime, distinctUntilChanged, switchMap, catchError, filter, map } from 'rxjs/operators'; 
import { ToastrService } from 'ngx-toastr';

import { PropertyService, ListingFilter } from '../../services/property.service';
import { ActivityService } from '../../services/activity.service';
import { RouteMeta } from '@analogjs/router';

import { SafetyConsentBottomSheetComponent, PendingAction } from '../../components/safety-consent/safety-consent';
import { ListingCardComponent } from '../../components/listing-card/listing-card';
import { ContactAccessService } from '../../services/contact-access.service';
import { paymentReturnNotice } from '../../utils/billing-return';
import {
  buildGeocodeQueries,
  getKnownZoneCoordinates,
  LocationSearchResult,
  rankLocationResults,
  searchLocalLocations,
} from '../../utils/location-search.util';

type SearchControlValue = string | LocationSearchResult | null;

export const routeMeta: RouteMeta = {
  title: 'Explore Rooms, PG & Flats for Rent | Roomzo',
  meta: [
    { name: 'description', content: 'Search owner-listed rooms, PGs, and flats for rent in Prayagraj, Varanasi, Pune, Lucknow and more. Contact owners directly and visit before you pay.' },
    { name: 'keywords', content: 'room rent, pg for rent, flat for rent, prayagraj, varanasi, pune, roomzo' },
    { property: 'og:title', content: 'Explore Rentals | Roomzo' },
    { property: 'og:description', content: 'Browse rooms, hostels, and flats with direct owner contact. Safety tips included before you call or WhatsApp.' },
    { property: 'og:type', content: 'website' },
    { property: 'og:image', content: 'https://www.roomzo.in/assets/og-roomzo-share.jpg' },
  ]
};

@Component({
  selector: 'app-explore-listings',
  standalone: true,
  imports: [
    CommonModule, MatIconModule, MatButtonModule, 
    FormsModule, ReactiveFormsModule, 
    MatAutocompleteModule, MatInputModule,
    SafetyConsentBottomSheetComponent, ListingCardComponent
  ],
  templateUrl: './explore-listing.html',
  styleUrls: ['./explore-listing.css']
})
export default class ExploreListingsComponent implements OnInit, OnDestroy {
  listings: any[] = [];
  totalItems = 0;
  isLoading = false;

  searchControl = new FormControl<SearchControlValue>('');
  filteredCities: LocationSearchResult[] = []; 
  selectedLocation: { city: string, state: string } | null = null;

filters: ListingFilter = { minPrice: 0, maxPrice: 50000, propertyType: 'Any', bedrooms: 'Any', sortBy: 'latest' }; // Changed to latest
  availabilityFilter: 'available' | 'all' = 'all';

  currentPage = 0;
  pageSize = 15;
  totalPages = 0;
  pagesArray: (number | string)[] = [];
  
  private searchSubscription: Subscription | null = null;
  isMobileFiltersOpen = false;

  placeholders: string[] = [
    'Search "Civil lines, Prayagraj"',
    'Search "Mumfordganj, Prayagraj"',
    'Search "Teliyarganj, Prayagraj"',
    'Search "Viman Nagar, Pune"',
    'Search "Katra, Prayagraj"',
    'Search "Lanka, Varanasi"',
  ];
  currentPlaceholder: string = '';
  private charIndex: number = 0;
  private placeholderIndex: number = 0;
  private typingTimeout: any;
  private isDestroyed = false;
  private documentClickListener: (() => void) | null = null;
  
  isDropdownOpen = false;

  userHasGivenConsent = signal(false); 
  isConsentModalOpen = signal(false);
  pendingAction = signal<PendingAction | any>(null);
  contactLoadingId: number | null = null;
  private paywallOpenedSub: Subscription | null = null;

  constructor(
    private propertyService: PropertyService,
    private activityService: ActivityService,
    private cd: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object,
    private renderer: Renderer2,
    private toastr: ToastrService,
    private contactAccess: ContactAccessService
  ) {}

  ngOnInit(): void {
    this.typeEffect();
    
    this.searchControl.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      filter((val): val is string => typeof val === 'string' && val.trim().length > 2), 
      switchMap(val => {
        const text = val as string;
        const upQuery = `${text}, Uttar Pradesh`;
        const mhQuery = `${text}, Maharashtra`;
        const upUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(upQuery)}&addressdetails=1&countrycodes=in&limit=5`;
        const mhUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mhQuery)}&addressdetails=1&countrycodes=in&limit=5`;
        
        return forkJoin({
          up: this.http.get<LocationSearchResult[]>(upUrl).pipe(catchError(() => of([]))),
          mh: this.http.get<LocationSearchResult[]>(mhUrl).pipe(catchError(() => of([])))
        }).pipe(
          map(({ up, mh }) => rankLocationResults(text, [...up, ...mh], 6))
        );
      })
    ).subscribe(results => {
      this.filteredCities = results || [];
      this.cd.detectChanges();
    });

    this.route.queryParams.subscribe(params => {
      this.filters.propertyType = params['propertyType'] ? params['propertyType'] : 'Any';
      if (Object.keys(params).length > 0) {
        if (params['city'] && params['state']) {
          const city = params['city'];
          const state = params['state'];
          const street = params['street'] ?? '';
          this.selectedLocation = { city, state };
          const displayVal = street ? `${street}, ${city}` : city;
          this.searchControl.setValue(displayVal, { emitEvent: false });
          this.filters.city = city;
          this.filters.state = state;
          this.activityService.logSearch({
            city,
            state,
            searchQuery: params['street'] || params['searchQuery'] || city,
            propertyType: this.filters.propertyType
          });
        }
        if (params['lat'] && params['lng']) {
          this.filters.lat = Number(params['lat']);
          this.filters.lng = Number(params['lng']);
        }
        if (params['maxPrice']) {
          this.filters.maxPrice = Number(params['maxPrice']);
        }
      }
      if (params['lat'] && params['lng']) {
        this.loadListings();
      } else if (this.searchControl.value) {
        this.resolveLocationThenLoad();
      } else {
        this.loadListings();
      }
    });

    if (isPlatformBrowser(this.platformId)) {
      this.documentClickListener = this.renderer.listen('document', 'click', (event: Event) => {
        const target = event.target as HTMLElement;
        const dropdownElement = document.querySelector('.pro-dropdown');
        if (this.isDropdownOpen && dropdownElement && !dropdownElement.contains(target)) {
          this.isDropdownOpen = false;
          this.cd.detectChanges();
        }
      });
    }
    this.checkReturnFromLogin();
    this.paywallOpenedSub = this.contactAccess.paywallOpened$.subscribe(() => {
      this.setContactLoading(null);
    });
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    if (this.searchSubscription) this.searchSubscription.unsubscribe();
    if (this.documentClickListener) this.documentClickListener();
    this.paywallOpenedSub?.unsubscribe();
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
      const pendingFavorite = localStorage.getItem('pendingFavoritePropertyId');
      if (pendingFavorite) {
        localStorage.removeItem('pendingFavoritePropertyId');
        this.propertyService.saveFavoriteProperty(pendingFavorite).subscribe({
          next: (res: any) => {
            if (res?.status === 1 || res?.status === '1') {
              this.toastr.success('Property saved to favorites.');
              this.loadListings();
            }
          },
          error: () => {
            this.toastr.error('Could not save your favorite right now.');
          }
        });
      }

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
            }
          });
        } catch (e) {
          localStorage.removeItem('pendingAction');
        }
      }
    }
  }

  displayCity = (result: LocationSearchResult | string | null): string => {
    if (!result) return '';
    if (typeof result === 'string') return result;
    const addr = result.address || {};
    const locality = addr.neighbourhood || addr.suburb || addr.village || addr.town || result.name || '';
    const city = addr.city || addr.state_district || addr.county || '';
    const state = addr.state || '';
    const parts = [locality, city, state].filter((val, index, arr) => val && arr.indexOf(val) === index);
    return parts.join(', ');
  }

  onCitySelected(event: any) {
    const result = event.option.value as LocationSearchResult;
    this.applyResolvedLocation(result);
    this.searchControl.setValue(this.displayCity(result), { emitEvent: false });
    this.currentPage = 0;
    this.loadListings();
  }

loadListings(): void {
    if (this.searchSubscription) this.searchSubscription.unsubscribe();
    this.isLoading = true;
    this.cd.detectChanges();

    const isRentedParam = this.availabilityFilter === 'available' ? false : undefined;

    if (!this.hasActiveLocationSearch()) {
      this.filters.lat = undefined;
      this.filters.lng = undefined;
      this.filters.city = undefined;
      this.filters.state = undefined;
      this.filters.zone = undefined;
    } else if (this.filters.lat == null || this.filters.lng == null) {
      const coords = this.resolveCoordsFromSearchText();
      if (coords) {
        this.filters.lat = coords.lat;
        this.filters.lng = coords.lng;
      }
    }

    if (
      this.filters.lat == null &&
      this.filters.lng == null &&
      this.filters.sortBy === 'nearest' &&
      isPlatformBrowser(this.platformId)
    ) {
      const storedLocation = localStorage.getItem('user_geo_location');
      if (storedLocation) {
        try {
          const parsed = JSON.parse(storedLocation);
          this.filters.lat = parsed.lat;
          this.filters.lng = parsed.lng;
        } catch (e) {}
      }
    }

    this.searchSubscription = this.propertyService.searchListingsWithFilters(this.currentPage, this.pageSize, this.filters, isRentedParam)
      .pipe(finalize(() => {
        this.isLoading = false;
        this.cd.detectChanges(); 
      }))
      .subscribe({
        next: (response: any) => {
          if (!response) {
              this.listings = [];
              this.totalItems = 0;
              return;
          }
          this.listings = response.listings || [];
          this.totalItems = response.totalItems || 0;
          this.totalPages = response.totalPages || 0;
          this.calculatePagination();
        },
        error: (err: any) => {
          this.listings = []; 
          this.totalItems = 0;
        }
      });
  }

  applyFilters(): void {
    this.currentPage = 0;
    this.resolveLocationThenLoad();
  }

  reloadListings(): void {
    this.currentPage = 0;
    this.loadListings();
  }

  private hasActiveLocationSearch(): boolean {
    const raw = this.searchControl.value;
    if (this.isLocationResult(raw)) return true;
    return typeof raw === 'string' && raw.trim().length > 0;
  }

  private resolveCoordsFromSearchText(): { lat: number; lng: number } | null {
    const raw = this.searchControl.value;
    const searchText = typeof raw === 'string' ? raw.trim() : '';
    if (!searchText) return null;

    const localMatch = searchLocalLocations(searchText, 1)[0];
    if (localMatch) {
      return { lat: parseFloat(localMatch.lat), lng: parseFloat(localMatch.lon) };
    }

    const knownZone = getKnownZoneCoordinates(searchText.split(',')[0].trim());
    return knownZone;
  }

  private isLocationResult(value: SearchControlValue): value is LocationSearchResult {
    return !!value && typeof value === 'object' && 'lat' in value && 'lon' in value;
  }

  private resolveLocationThenLoad(): void {
    const raw = this.searchControl.value;

    if (this.isLocationResult(raw)) {
      this.applyResolvedLocation(raw);
      this.loadListings();
      return;
    }

    const searchText = typeof raw === 'string' ? raw.trim() : '';
    if (!searchText) {
      this.filters.lat = undefined;
      this.filters.lng = undefined;
      this.filters.city = undefined;
      this.filters.state = undefined;
      this.filters.zone = undefined;
      this.selectedLocation = null;
      this.loadListings();
      return;
    }

    const localMatch = searchLocalLocations(searchText, 1)[0];
    if (localMatch) {
      this.applyResolvedLocation(localMatch);
      this.searchControl.setValue(this.displayCity(localMatch), { emitEvent: false });
      this.loadListings();
      return;
    }

    this.isLoading = true;
    this.cd.detectChanges();
    this.geocodeSearchText(searchText).subscribe((result) => {
      if (result) {
        this.applyResolvedLocation(result);
        this.searchControl.setValue(this.displayCity(result), { emitEvent: false });
      } else {
        this.filters.lat = undefined;
        this.filters.lng = undefined;
        this.filters.zone = undefined;
        this.toastr.warning('Could not find that location. Try selecting from suggestions.');
      }
      this.loadListings();
    });
  }

  private geocodeSearchText(text: string): Observable<LocationSearchResult | null> {
    const queries = buildGeocodeQueries(text);
    const requests = queries.map((query) => {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&countrycodes=in&limit=5`;
      return this.http.get<LocationSearchResult[]>(url).pipe(catchError(() => of([])));
    });

    return forkJoin(requests).pipe(
      map((resultSets) => rankLocationResults(text, resultSets.flat(), 1)[0] ?? null)
    );
  }

  private applyResolvedLocation(result: LocationSearchResult): void {
    this.filters.lat = parseFloat(result.lat);
    this.filters.lng = parseFloat(result.lon);
    this.filters.city = undefined;
    this.filters.state = undefined;
    this.filters.zone = undefined;

    const addr = result.address || {};
    const city = addr.city || addr.town || addr.village || addr.county || result.roomzoZone || '';
    const state = addr.state || '';
    this.selectedLocation = city ? { city, state } : null;
    this.activityService.logSearch({
      city,
      state,
      searchQuery: this.displayCity(result),
      propertyType: this.filters.propertyType,
    });
  }

  resetFilters(): void {
this.filters = { minPrice: 0, maxPrice: 50000, propertyType: 'Any', bedrooms: 'Any', sortBy: 'latest' };    this.searchControl.setValue('');
    this.selectedLocation = null;
    this.availabilityFilter = 'available';
    this.applyFilters();
  }

  changePage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadListings();
    }
  }

  calculatePagination(): void {
    this.pagesArray = Array.from({ length: this.totalPages }, (_, i) => i);
  }

  formatPrice(price: number): string {
    return '₹' + (price ? price.toLocaleString() : '0');
  }

  formatPostedDate(dateString?: string): string {
    if (!dateString) return 'Recently posted';
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  
  viewDetails(id: string | number) {
      this.router.navigate(['/room', id]);
  }

  toggleSavedListing(item: any): void {
    const isLoggedIn = this.isUserLoggedIn() || this.isOwnerLoggedIn();
    if (!isLoggedIn) {
      localStorage.setItem('pendingFavoritePropertyId', String(item.id));
      const shouldNavigate = window.confirm('Please log in to save this property. Would you like to go to the login page now?');
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
          this.toastr.error(res?.message || 'Could not update favorites right now.');
        }
        this.cd.detectChanges();
      },
      error: () => {
        item.isFavorite = !nextValue;
        this.toastr.error('Could not update favorites right now.');
        this.cd.detectChanges();
      }
    });
  }
  
  toggleMobileFilters(): void {
    this.isMobileFiltersOpen = !this.isMobileFiltersOpen;
  }

  scrollToContact(id: string): void {
    this.router.navigate(['/room', id], { queryParams: { focusContact: 'true' } });
  }

  private typeEffect() {
    if (this.isDestroyed) return;
    const currentWord = this.placeholders[this.placeholderIndex];
    if (this.charIndex < currentWord.length) {
      this.ngZone.run(() => {
        this.currentPlaceholder += currentWord.charAt(this.charIndex);
        this.cd.markForCheck();   
      });
      this.charIndex++;
      this.typingTimeout = setTimeout(() => this.typeEffect(), 40);
    } else {
      this.typingTimeout = setTimeout(() => this.eraseEffect(), 1800);
    }
  }

  private eraseEffect() {
    if (this.isDestroyed) return;
    if (this.charIndex > 0) {
      this.ngZone.run(() => {
        this.currentPlaceholder = this.currentPlaceholder.substring(0, this.charIndex - 1);
        this.cd.markForCheck();   
      });
      this.charIndex--;
      this.typingTimeout = setTimeout(() => this.eraseEffect(), 25);
    } else {
      this.placeholderIndex = (this.placeholderIndex + 1) % this.placeholders.length;
      this.typingTimeout = setTimeout(() => this.typeEffect(), 200);
    }
  }

  typeof(val: any): string {
    return typeof val;
  }

  onScroll(event: WheelEvent, element: HTMLElement): void {
    const canScrollHorizontally = element.scrollWidth > element.clientWidth;
    if (canScrollHorizontally && event.deltaY !== 0) {
      event.preventDefault();
      element.scrollLeft += event.deltaY;
    }
  }
  
  scrollPagination(element: HTMLElement, direction: 'left' | 'right'): void {
    const scrollAmount = 144; 
    if (direction === 'left') {
      element.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
      element.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  }

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
    this.cd.detectChanges();  
  }

  selectSort(value: string) {
    this.filters.sortBy = value;
    this.isDropdownOpen = false;
    this.reloadListings();
    this.cd.detectChanges();
  }

  getSortLabel(): string {
    switch(this.filters.sortBy) {
      case 'latest': return 'Latest First';
      case 'oldest': return 'Oldest First';
      default: return 'Nearest First';
    }
  }

  handleCardContactAction(prop: any, actionType: 'call' | 'whatsapp') {
    if (this.contactLoadingId != null || this.contactAccess.isPaywallOpen()) return;
    if (this.isUserLoggedIn() || this.isOwnerLoggedIn()) {
      this.setContactLoading(Number(prop.id));
      const actionPayload = { prop, actionType };
      this.checkAndExecuteConsent(actionPayload, () => {
        this.executeContactAction(prop, actionType);
      });
    } else {
      const returnUrl = this.router.url; 
      localStorage.setItem('pendingAction', JSON.stringify({ action: actionType, propertyId: prop.id }));
      this.router.navigate(['/owner-auth'], { queryParams: { returnUrl: returnUrl } });
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
    if (this.userHasGivenConsent() || (isPlatformBrowser(this.platformId) && localStorage.getItem('safetyConsentGiven') === 'true')) {
      this.userHasGivenConsent.set(true);
      successCallback();
      return;
    }

let userId: string | null = null;
    if (isPlatformBrowser(this.platformId)) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try { userId = JSON.parse(storedUser).id; } catch (e) {}
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
        }
      });
    } else {
      this.setContactLoading(null);
      this.pendingAction.set(actionData);
      this.isConsentModalOpen.set(true);
      this.cd.detectChanges();
    }
  }

  onConsentAccepted(action: any) {
let userId: string | null = null;
    if (isPlatformBrowser(this.platformId)) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try { userId = JSON.parse(storedUser).id; } catch (e) {}
      }
    }

    const proceedWithAction = () => {
      this.executeContactAction(action.prop, action.actionType);
    };

    if (userId) {
      this.propertyService.updateSafetyConsent(userId, true).subscribe({
        next: (res: any) => {
          if (res.status === 1) {
            this.userHasGivenConsent.set(true);
            if (isPlatformBrowser(this.platformId)) localStorage.setItem('safetyConsentGiven', 'true');
            proceedWithAction();
          } else {
            this.toastr.error('Failed to record consent. Please try again.');
          }
        },
        error: (err) => {
          this.toastr.error('Server error while recording consent.');
        }
      });
    } else {
      this.userHasGivenConsent.set(true);
      if (isPlatformBrowser(this.platformId)) localStorage.setItem('safetyConsentGiven', 'true');
      proceedWithAction();
    }
  }

  isUserLoggedIn(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    return !!(localStorage.getItem('token') || localStorage.getItem('user'));
  }

  isOwnerLoggedIn(): boolean {
    return this.isUserLoggedIn(); 
  }

  quickSearch(zoneName: string, stateName: string): void {
    this.searchControl.setValue(`${zoneName}, Prayagraj`, { emitEvent: false });
    this.selectedLocation = { city: 'Prayagraj', state: stateName };
    this.filters.city = undefined;
    this.filters.state = undefined;
    this.filters.zone = undefined;

    const coords = getKnownZoneCoordinates(zoneName);
    if (coords) {
      this.filters.lat = coords.lat;
      this.filters.lng = coords.lng;
      this.reloadListings();
      return;
    }

    this.filters.lat = undefined;
    this.filters.lng = undefined;
    this.applyFilters();
  }

  // Add this inside your ExploreListingsComponent class
 // In index.page.ts ExploreListingsComponent
  trendingZones = [
    { name: 'Allahpur', city: 'Prayagraj', slug: 'prayagraj', icon: 'location_city', trending: true },
    { name: 'Stanley Road', city: 'Prayagraj', slug: 'prayagraj', icon: 'business', trending: false },
    { name: 'Lanka', city: 'Varanasi', slug: 'varanasi', icon: 'account_balance', trending: true },
    { name: 'Civil Lines', city: 'Prayagraj', slug: 'prayagraj', icon: 'domain', trending: false },
    { name: 'Mutthiganj', city: 'Prayagraj', slug: 'prayagraj', icon: 'map', trending: false }
  ];

  navigateToZone(zone: any) {
    this.router.navigate(['/city', zone.slug], { queryParams: { zone: zone.name } });
  }
}