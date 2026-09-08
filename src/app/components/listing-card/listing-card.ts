import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { PropertyService } from '../../services/property.service';
import { PropertyMediaCarouselComponent } from '../property-media-carousel/property-media-carousel';
import { getListingPhotoUrls, ListingPhotoInput } from '../../utils/image-seo.util';

export interface ListingCardItem {
  id: number;
  title: string;
  location: string;
  price: number;
  priceUnit?: string;
  image: string;
  photos?: ListingPhotoInput[];
  badge: { text: string; color: 'blue' | 'green' | 'purple' };
  specs: { beds: number; baths: number; area: number };
  postedDate?: string;
  isRented?: boolean;
  isFavorite?: boolean;
  contactNo?: string;
  tempContactNo?: string;
  [key: string]: any;
}

@Component({
  selector: 'app-listing-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, PropertyMediaCarouselComponent],
  templateUrl: './listing-card.html',
  styleUrls: ['./listing-card.css']
})
export class ListingCardComponent implements OnInit, OnChanges {
  @Input() listing!: ListingCardItem;
  @Input() showActions = true;
  @Input() showSpecs = true;
  @Input() showAvailabilityBadge = true;
  /** Compact home/featured layout: image + type/city pills + title + price. */
  @Input() compact = false;
  /** Hidden by default so public feeds don't look "old". Sorting still uses postedDate. */
  @Input() showPostedDate = false;
  @Input() priceUnit = '/month';
  @Input() locationIcon = 'location_on';
  @Input() availabilityLabel = 'Verified Listing';
  @Input() imageFallback = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&q=80';
  /** True while consent/unlock is in flight for this card. */
  @Input() contactLoading = false;

  @Output() view = new EventEmitter<ListingCardItem>();
  @Output() call = new EventEmitter<ListingCardItem>();
  @Output() whatsapp = new EventEmitter<ListingCardItem>();
  @Output() save = new EventEmitter<ListingCardItem>();

  isSaved = false;

  constructor(private propertyService: PropertyService) {}

  ngOnInit(): void {
    this.syncSavedState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['listing']) {
      this.syncSavedState();
    }
  }

  ngDoCheck(): void {
    const nextSavedState = this.getSavedStateFromCache();
    if (this.isSaved !== nextSavedState) {
      this.isSaved = nextSavedState;
    }
  }

  private getSavedStateFromCache(): boolean {
    const favoriteIds = new Set(this.propertyService.getFavoritePropertyIds().map(String));
    const currentId = this.listing?.id != null ? String(this.listing.id) : '';
    return Boolean(currentId && favoriteIds.has(currentId));
  }

  private syncSavedState(): void {
    this.isSaved = this.getSavedStateFromCache();
  }

  getTitle(): string {
    if (this.listing?.['title']) return this.listing['title'];
    if (this.listing?.['propertyName']) return this.listing['propertyName'];
    if (this.listing?.['propertyType'] && this.listing?.['street']) {
      return `${this.listing['propertyType']} in ${this.listing['street']}`;
    }
    return 'Property';
  }

  getLocation(): string {
    if (this.listing?.['location']) return this.listing['location'];
    const parts = [this.listing?.['street'], this.listing?.['city'], this.listing?.['state']].filter(Boolean);
    return parts.length ? parts.join(', ') : 'Location unavailable';
  }

  /** Local area for card labels — street / landmark / zone, not the city name. */
  getLocalityLabel(): string {
    const city = String(this.listing?.['city'] || '').trim();
    const normalize = (value: unknown): string => String(value || '').trim();
    const isCityOnly = (value: string): boolean => {
      if (!value) return true;
      if (!city) return false;
      const v = value.toLowerCase();
      const c = city.toLowerCase();
      return v === c || v.startsWith(`${c},`) || v.endsWith(`, ${c}`);
    };

    const candidates = [
      this.listing?.['landmark'],
      this.listing?.['zone'],
      this.listing?.['street'],
      this.listing?.['locality'],
      this.listing?.['area'],
    ];

    for (const candidate of candidates) {
      const label = normalize(candidate);
      if (!label || isCityOnly(label)) continue;
      // Prefer a short street/area name (first segment if long address)
      const short = label.split(',')[0]?.trim() || label;
      if (short && !isCityOnly(short)) return short;
    }

    // Mapped UI location may already be "City, State" — skip that.
    const mapped = normalize(this.listing?.['location']);
    if (mapped && !isCityOnly(mapped)) {
      const short = mapped.split(',')[0]?.trim() || mapped;
      if (short && !isCityOnly(short)) return short;
    }

    return city || 'Location unavailable';
  }

  getPrice(): number {
    return this.listing?.['price'] ?? this.listing?.['rentAmount'] ?? this.listing?.['rent_amount'] ?? 0;
  }

  getImageUrl(): string {
    if (this.listing?.['image']) return this.listing['image'];
    return getListingPhotoUrls(this.listing?.photos, this.imageFallback)[0];
  }

  getPhotos(): ListingPhotoInput[] | null {
    return this.listing?.photos ?? null;
  }

  getBeds(): number {
    return this.listing?.['specs']?.['beds'] ?? this.listing?.['bedrooms'] ?? 0;
  }

  getBaths(): number {
    return this.listing?.['specs']?.['baths'] ?? this.listing?.['bathrooms'] ?? 0;
  }

  getArea(): number {
    return this.listing?.['specs']?.['area'] ?? this.listing?.['propertySize'] ?? this.listing?.['property_size'] ?? 0;
  }

  /** Flat always shows Kitchen; otherwise show Kitchen only when hasKitchen is true. */
  shouldShowKitchenSpec(): boolean {
    const type = String(
      this.listing?.['propertyType'] || this.listing?.['property_type'] || this.getPropertyTypeLabel() || ''
    ).toLowerCase();
    if (type.includes('flat') || type.includes('apartment') || type.includes('bhk')) {
      return true;
    }
    return !!(
      this.listing?.['hasKitchen'] ||
      this.listing?.['has_kitchen'] ||
      this.listing?.['kitchen']
    );
  }

  getPostedDate(): string | undefined {
    return this.listing?.['postedDate'] ?? this.listing?.['createdOn'] ?? this.listing?.['created_on'] ?? this.listing?.['dateCreated'];
  }

  getBadgeLabel(): string {
    if (Number(this.listing?.['isRented']) === 1) {
      return 'Rented';
    }
    const label = (this.availabilityLabel || 'Verified Listing').trim();
    // Normalize legacy / common labels
    if (/^owner listing$/i.test(label) || /^verified listing$/i.test(label)) {
      return 'Verified Listing';
    }
    return label;
  }

  getPropertyTypeLabel(): string {
    const raw =
      this.listing?.['propertyType'] ||
      this.listing?.['property_type'] ||
      this.listing?.badge?.text ||
      'Room';
    const s = String(raw).trim();
    if (!s) return 'Room';
    // Keep short labels like Room / Flat / PG
    if (/flatmate/i.test(s)) return 'Flatmate';
    if (/\bpg\b|paying\s*guest|hostel/i.test(s)) return 'PG';
    if (/flat|apartment|bhk/i.test(s)) return 'Flat';
    if (/room/i.test(s)) return 'Room';
    return s.length > 12 ? s.slice(0, 12) : s;
  }

  getCityLabel(): string {
    const city = this.listing?.['city'];
    if (city) return String(city).trim();
    const loc = this.getLocation();
    return loc.split(',')[0]?.trim() || '';
  }

  showContactActions(): boolean {
    return this.showActions && Number(this.listing?.['isRented']) !== 1;
  }

  formatPrice(price: number): string {
    const n = Number(price) || 0;
    return '₹' + n.toLocaleString('en-IN');
  }

  formatPostedDate(dateString?: string): string {
    if (!dateString) return 'Recently posted';
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  onViewDetails(event?: Event): void {
    event?.stopPropagation();
    this.view.emit(this.listing);
  }

  onCallClick(event: Event): void {
    event.stopPropagation();
    this.call.emit(this.listing);
  }

  onWhatsAppClick(event: Event): void {
    event.stopPropagation();
    this.whatsapp.emit(this.listing);
  }

  onSaveClick(event: Event): void {
    event.stopPropagation();
    this.isSaved = !this.isSaved;
    this.save.emit(this.listing);
  }
}
