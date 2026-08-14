import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

// 1. EXACT DATA STRUCTURE
export interface PropertyListing {
  id: string;
  dateCreated: Date;
  details: {
    propertyType: string;
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    bedrooms: number;
    bathrooms: number;
    propertySize: number;
  };
  amenities: any; 
  final: {
    description: string;
    rentAmount: number;
    images: string[];
    title: string;
    status?: string;
  };
}

// Filter Interface
export interface ListingFilter {
  minPrice?: number;
  maxPrice?: number;
  propertyType?: string;
  bedrooms?: string;
  searchQuery?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ListingService {

  // 2. MOCK DATABASE
  // I have populated 'amenities' so your details page looks good immediately.
  private mockListings: PropertyListing[] = [
    {
      id: '1',
      dateCreated: new Date('2023-10-01'),
      details: {
        propertyType: 'Apartment',
        address: { street: '123 Valencia St', city: 'San Francisco', state: 'CA', zip: '94103' },
        bedrooms: 2, bathrooms: 2, propertySize: 950
      },
      amenities: { wifi: true, ac: true, pets: true, parking: true },
      final: {
        title: 'Sunny Mission Apartment',
        description: 'Experience luxury living in the heart of San Francisco. This stunning apartment offers natural light, modern finishes, and hardwood floors throughout.',
        rentAmount: 2400,
        images: ['https://images.unsplash.com/photo-1600596542815-27b88e31e640?w=800&q=80', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80'],
        status: 'VERIFIED'
      }
    },
    {
      id: '2',
      dateCreated: new Date('2023-11-15'),
      details: {
        propertyType: 'House',
        address: { street: '789 Oak Ave', city: 'Palo Alto', state: 'CA', zip: '94301' },
        bedrooms: 4, bathrooms: 3, propertySize: 2100
      },
      amenities: { parking: true, gym: true, balcony: true, heating: true, washerDryer: true },
      final: {
        title: 'Spacious Family Home',
        description: 'Perfect for families, this spacious home features a large backyard, updated kitchen, and proximity to excellent schools.',
        rentAmount: 4200,
        images: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80'],
        status: 'NEW'
      }
    },
    {
      id: '3',
      dateCreated: new Date('2023-09-20'),
      details: {
        propertyType: 'Studio',
        address: { street: '22 Sunset Blvd', city: 'Los Angeles', state: 'CA', zip: '90028' },
        bedrooms: 0, bathrooms: 1, propertySize: 500
      },
      amenities: { wifi: true, washerDryer: true, heating: true },
      final: {
        title: 'Cozy Studio with View',
        description: 'Compact living at its finest. Enjoy sunset views from your window in this efficiently designed studio.',
        rentAmount: 1850,
        images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80'],
        status: ''
      }
    },
    {
      id: '4',
      dateCreated: new Date('2023-12-01'),
      details: {
        propertyType: 'Apartment',
        address: { street: '450 Market St', city: 'San Francisco', state: 'CA', zip: '94104' },
        bedrooms: 1, bathrooms: 1, propertySize: 820
      },
      amenities: { gym: true, wifi: true, elevator: true },
      final: {
        title: 'Modern Loft Downtown',
        description: 'Close to work and nightlife. This loft features high ceilings and industrial chic decor.',
        rentAmount: 3150,
        images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80'],
        status: 'FEATURED'
      }
    },
    {
      id: '5',
      dateCreated: new Date('2023-12-05'),
      details: {
        propertyType: 'House',
        address: { street: '88 Maple Dr', city: 'Berkeley', state: 'CA', zip: '94704' },
        bedrooms: 3, bathrooms: 2, propertySize: 1600
      },
      amenities: { parking: true, balcony: true, pets: true },
      final: {
        title: 'Renovated Craftsman',
        description: 'Beautiful wood details and a renovated kitchen make this craftsman home a gem.',
        rentAmount: 3800,
        images: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80'],
        status: 'PENDING'
      }
    },
    {
      id: '6',
      dateCreated: new Date('2023-12-10'),
      details: {
        propertyType: 'Apartment',
        address: { street: '101 Spear St', city: 'San Francisco', state: 'CA', zip: '94105' },
        bedrooms: 2, bathrooms: 2, propertySize: 1100
      },
      amenities: { wifi: true, gym: true, pool: true },
      final: {
        title: 'Urban Living Space',
        description: 'Modern and chic apartment in the financial district.',
        rentAmount: 2950,
        images: ['https://images.unsplash.com/photo-1484154218962-a1c002085d2f?w=800&q=80'],
        status: ''
      }
    }
  ];

  constructor() { }

  /**
   * Main Query Method: Filters -> Sorts -> Paginates
   */
  getListings(
    filter: ListingFilter,
    page: number = 1,
    pageSize: number = 6
  ): Observable<{ data: PropertyListing[], total: number }> {
    
    // 1. FILTERING LOGIC
    let filtered = this.mockListings.filter(item => {
      const price = item.final.rentAmount;
      const type = item.details.propertyType;
      const beds = item.details.bedrooms;
      
      // Price Check
      if (filter.minPrice && price < filter.minPrice) return false;
      if (filter.maxPrice && price > filter.maxPrice) return false;

      // Type Check (If selected and not empty)
      if (filter.propertyType && filter.propertyType !== 'Any' && type !== filter.propertyType) return false;

      // Bedroom Check
      if (filter.bedrooms && filter.bedrooms !== 'Any') {
        const minBeds = parseInt(filter.bedrooms.replace('+', ''), 10);
        if (beds < minBeds) return false;
      }

      // Search Query
      if (filter.searchQuery) {
        const q = filter.searchQuery.toLowerCase();
        
        // Safe Checks using Optional Chaining (?)
        const titleMatch = item.final?.title?.toLowerCase().includes(q) || false;
        const cityMatch = item.details?.address?.city?.toLowerCase().includes(q) || false;
        const streetMatch = item.details?.address?.street?.toLowerCase().includes(q) || false;
        
        if (!titleMatch && !cityMatch && !streetMatch) return false;
      }

      return true;
    });

    // 2. PAGINATION LOGIC
    const total = filtered.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedData = filtered.slice(startIndex, endIndex);

    // Return as Observable (simulates API delay)
    return of({ data: paginatedData, total }).pipe(delay(300));
  }

  /**
   * Get Single Listing by ID
   * Uses String conversion to be safe against number/string type mismatches
   */
  getListingById(id: string): Observable<PropertyListing | undefined> {
    const listing = this.mockListings.find(item => String(item.id) === String(id));
    return of(listing).pipe(delay(200));
  }

  /**
   * Get Similar Listings
   * Returns up to 3 listings that are NOT the current one
   */
  getSimilarListings(currentId: string): Observable<PropertyListing[]> {
    const similar = this.mockListings
      .filter(item => String(item.id) !== String(currentId))
      .slice(0, 3);
      
    return of(similar).pipe(delay(200));
  }

  /**
   * Amenities Config Map
   * Central place to define icons and labels
   */
  getAmenitiesMap() {
    return [
      { key: 'wifi', label: 'Fast Wifi', icon: 'wifi' },
      { key: 'ac', label: 'Central AC', icon: 'ac_unit' },
      { key: 'heating', label: 'Heating', icon: 'thermostat' },
      { key: 'parking', label: 'Dedicated Parking', icon: 'local_parking' },
      { key: 'gym', label: 'Gym Access', icon: 'fitness_center' },
      { key: 'washerDryer', label: 'Washer & Dryer', icon: 'local_laundry_service' },
      { key: 'balcony', label: 'Private Balcony', icon: 'balcony' },
      { key: 'pets', label: 'Pet Friendly', icon: 'pets' },
      { key: 'smokeAlarm', label: 'Smoke Alarm', icon: 'detector_smoke' }
    ];
  }
}