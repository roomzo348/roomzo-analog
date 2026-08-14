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
  @Input() showPostedDate = true;
  @Input() priceUnit = '/month';
  @Input() locationIcon = 'location_on';
  @Input() availabilityLabel = 'Available';
  @Input() imageFallback = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&q=80';

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

  getPostedDate(): string | undefined {
    return this.listing?.['postedDate'] ?? this.listing?.['createdOn'] ?? this.listing?.['created_on'] ?? this.listing?.['dateCreated'];
  }

  getBadgeLabel(): string {
    if (Number(this.listing?.['isRented']) === 1) {
      return 'Rented';
    }
    return this.availabilityLabel;
  }

  showContactActions(): boolean {
    return this.showActions && Number(this.listing?.['isRented']) !== 1;
  }

  formatPrice(price: number): string {
    return price >= 10000 ? '₹' + (price / 1000).toFixed(0) + 'k' : '₹' + price.toLocaleString();
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
