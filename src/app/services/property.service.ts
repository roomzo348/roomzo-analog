import { ComponentFactoryResolver, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { forkJoin, Observable, of, switchMap } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ListingFilter {
  minPrice?: number;
  maxPrice?: number;
  propertyType?: string;
  bedrooms?: string | number;
  searchQuery?: string;
  sortBy?: string;
  lat?: number;
  lng?: number;
  city?: string;
  state?: string;
  zone?: string;
}
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
  final: {
    description: string;
    rentAmount: number;
    images: string[];
  };
  amenities: {
    wifi: boolean;
    heating: boolean;
    ac: boolean;
    washerDryer: boolean;
    parking: boolean;
    gym: boolean;
    balcony: boolean;
    pets: boolean;
    smokeAlarm: boolean;
    coAlarm: boolean;
  };
}
export interface PaginatedResponse {
  status: number;
  message: string;
  listings: any[]; // Or use your specific PropertyListing interface here
  currentPage: number;
  totalItems: number;
  totalPages: number;
}
@Injectable({
  providedIn: 'root'
})
export class PropertyService {
  private storageKey = 'rental_properties';
  private baseUrl = environment.apiUrl;
  private uploadUrl = `${environment.apiUrl || ''}/api/upload`;
  private favoriteIdsStorageKey = 'roomzo_favorite_ids';

  constructor(private http: HttpClient) {}

  getFavoritePropertyIds(): string[] {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }

    const stored = window.localStorage.getItem(this.favoriteIdsStorageKey);
    if (!stored) {
      return [];
    }

    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  extractFavoriteIdsFromPayload(payload: any): string[] {
    const list = payload?.data ?? payload?.favorites ?? payload?.items ?? payload ?? [];
    const favorites = Array.isArray(list) ? list : list?.listings ?? list?.properties ?? [];

    return favorites
      .map((item: any) => {
        const property = item?.property ?? item?.listing ?? item;
        return property?.id ?? item?.propertyId ?? item?.listingId ?? item?.id;
      })
      .filter((id: any) => id != null && id !== '')
      .map((id: any) => String(id));
  }

  private setFavoritePropertyIds(ids: string[]): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(this.favoriteIdsStorageKey, JSON.stringify(ids));
    }
  }

  saveFavoriteProperty(propertyId: string | number): Observable<any> {
    const user = this.getStoredUser();
    if (!user?.id) {
      return of({ status: 0, message: 'User not logged in' });
    }

    return this.http.post(`${this.baseUrl}/api/favourites/save`, {
      userId: user.id,
      propertyId
    }).pipe(
      tap((res: any) => {
        if (res?.status === 1 || res?.status === '1') {
          console.log("favourites res" ,res);
          const current = this.getFavoritePropertyIds();
          const next = Array.from(new Set([...current, String(propertyId)]));
          this.setFavoritePropertyIds(next);
        }
      })
    );
  }

  removeFavoriteProperty(propertyId: string | number): Observable<any> {
    const user = this.getStoredUser();
    if (!user?.id) {
      return of({ status: 0, message: 'User not logged in' });
    }

    return this.http.delete(`${this.baseUrl}/api/favourites/remove`, {
      body: { userId: user.id, propertyId }
    }).pipe(
      tap((res: any) => {
        if (res?.status === 1 || res?.status === '1') {
          const current = this.getFavoritePropertyIds();
          const next = current.filter((id) => id !== String(propertyId));
          this.setFavoritePropertyIds(next);
        }
      })
    );
  }

  getFavoriteProperties(): Observable<any> {
    const user = this.getStoredUser();
    if (!user?.id) {
      return of({ status: 0, message: 'User not logged in', data: [] });
    }

    return this.http.get(`${this.baseUrl}/api/favourites/user/${user.id}`).pipe(
      tap((res: any) => {
        const ids = this.extractFavoriteIdsFromPayload(res);
        if (ids.length) {
          this.setFavoritePropertyIds(ids);
        }
      })
    );
  }

  private getStoredUser(): any {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    try {
      return JSON.parse(window.localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }

 getListings(): PropertyListing[] {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data = window.localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    }
    return []; 
  }

saveListing(formData: any): Observable<any> {
    const files: File[] = formData.final.images || [];

    const uploadObservables = files.length > 0
      ? files.map((file, index) =>
          this.uploadImageToHostinger(file).pipe(
            tap(res => console.log(`[File ${index + 1}] Upload Response:`, res)),
            catchError(err => {
              console.error(`[File ${index + 1}] Upload FAILED:`, err);
              return of(null);
            })
          )
        )
      : [of(null)];

    return forkJoin(uploadObservables).pipe(
      switchMap((responses: any[]) => {
        
        // Upload API returns public symlink URL: https://roomzo.in/images/file.jpg
        const photoUrls = responses
          .filter(res => res && res.status === 1 && res.url && !String(res.url).includes('-org'))
          .map(res => this.toPublicImageUrl(res.url));

        // If files were provided but none uploaded successfully, abort – don't save to DB
        if (files.length > 0 && photoUrls.length === 0) {
          throw new Error('Image upload failed. Please check your internet connection and try again.');
        }

        const user = JSON.parse(localStorage.getItem("user") || '{}');
        const { final, ...rest } = formData;
        const { images, ...finalWithoutImages } = final;

        const finalPayload = {
          ...rest,
          final: finalWithoutImages, 
          photos: photoUrls, // Backend only sees the watermarked URLs
          ownerId: user.id
        };

        return this.http.post(`${this.baseUrl}/api/listings/add`, finalPayload);
      })
    );
  }

  private uploadImageToHostinger(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('secret_key', environment.uploadSecretKey);

    // DO NOT set headers manually; Angular will set multipart/form-data automatically
    return this.http.post<any>(this.uploadUrl, formData);
  }

  /** DB / display URL via symlink: https://roomzo.in/images/file.jpg — never storage/ or base64. */
  private toPublicImageUrl(url: string): string {
    const raw = String(url || '').trim();
    if (!raw) return raw;
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    const base = environment.hostingerUploadUrl.replace(/\/+$/, '') || 'https://roomzo.in';
    return `${base}${raw.startsWith('/') ? raw : `/${raw}`}`;
  }

  getAllListings(page: number, size: number, isRented?: boolean): Observable<PaginatedResponse> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size);

    // Only add isRented if it's explicitly passed (true or false)
    if (isRented !== undefined && isRented !== null) {
      params = params.set('isRented', isRented);
    }

    return this.http.get<PaginatedResponse>(`${this.baseUrl}/api/listings/all`, { params });
  }

  // --- API 2: Search by Location (with Pagination & Optional Filter) ---
  searchListings(state: string, city: string, page: number, size: number, isRented?: boolean): Observable<PaginatedResponse> {
    let params = new HttpParams()
      .set('state', state)
      .set('city', city)
      .set('page', page)
      .set('size', size);

    if (isRented !== undefined && isRented !== null) {
      params = params.set('isRented', isRented ? 1:0);
    }

    return this.http.get<PaginatedResponse>(`${this.baseUrl}/api/listings/search`, { params });
  }
  getLocationFromCoords(lat: number, lng: number): Observable<any> {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    return this.http.get(url);
  }
  getAllListingsWithFilters(page: number, size: number, filters?: ListingFilter, isRented?: boolean): Observable<any> {
    let params = this.buildParams(page, size, filters, isRented);
    console.log('All Listings with Filters - Params:', params.toString());
    return this.http.get(`${this.baseUrl}/api/listings/allWithFilters`, { params });
  }



  getListingById(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/listings/${id}`);
  }
  getGeocode(city: string, state: string): Observable<any> {
    const query = `${city}, ${state}`;
    return this.http.get(`https://nominatim.openstreetmap.org/search`, {
      params: {
        q: query,
        format: 'json',
        limit: '1'
      }
    });
  }
  getMyListings(ownerId: number): Observable<any> {
    // Matches your Java Controller: @GetMapping("/owner/{ownerId}")
return this.http.get(`${this.baseUrl}/api/listings/owner/${ownerId}`);
  }
  // --- Update Listing (PUT) — uploads new images first when provided ---
  updateListing(id: string, payload: any, newImages: File[] = [], originalImages: File[] = []): Observable<any> {
    const filesToUpload = [...newImages, ...originalImages];

    if (filesToUpload.length === 0) {
      return this.http.put(`${this.baseUrl}/api/listings/update/${id}`, payload);
    }

    const uploadObservables = filesToUpload.map((file) =>
      this.uploadImageToHostinger(file).pipe(
        catchError((err) => {
          console.error('Image upload failed:', err);
          return of(null);
        })
      )
    );

    return forkJoin(uploadObservables).pipe(
      switchMap((responses: any[]) => {
        const uploadedUrls = responses
          .filter((res) => res && res.status === 1 && res.url && !String(res.url).includes('-org'))
          .map((res) => this.toPublicImageUrl(res.url));

        if (filesToUpload.length > 0 && uploadedUrls.length === 0) {
          throw new Error('Image upload failed. Please try again.');
        }

        const existingUrls: string[] = payload.photos || [];
        const finalPayload = {
          ...payload,
          photos: [...existingUrls, ...uploadedUrls],
        };

        return this.http.put(`${this.baseUrl}/api/listings/update/${id}`, finalPayload);
      })
    );
  }
  updateListingStatus(propertyId: number, status: string): Observable<any> {

  return this.http.patch(`${this.baseUrl}/api/listings/${propertyId}/status`, null, {
    params: { status: status }
  });
}
searchListingsWithFilters(page: number, size: number, filters?: ListingFilter, isRented?: boolean): Observable<any> {
    let params = this.buildParams(page, size, filters, isRented);
    return this.http.get(`${this.baseUrl}/api/listings/searchWithFilters`, { params });
  }

  private buildParams(page: number, size: number, filters?: ListingFilter, isRented?: any): HttpParams {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size);

    if (isRented !== undefined && isRented !== null) {
      params = params.set('isRented', isRented?1:0);
    }

    if (filters) {
      if (filters.minPrice) params = params.set('minPrice', filters.minPrice);
      if (filters.maxPrice) params = params.set('maxPrice', filters.maxPrice);
      if (filters.propertyType && filters.propertyType !== 'Any') params = params.set('propertyType', filters.propertyType);
      
      if (filters.bedrooms && filters.bedrooms !== 'Any') {
         const bedVal = filters.bedrooms.toString().replace('+', '');
         params = params.set('bedrooms', bedVal);
      }

      // Geo-spatial sorting parameters ONLY
      if (filters.lat != null && filters.lng != null) {
        params = params.set('lat', String(filters.lat));
        params = params.set('lng', String(filters.lng));
      }
      if (filters.city) params = params.set('city', filters.city);
      if (filters.state) params = params.set('state', filters.state);
      if (filters.zone) params = params.set('zone', filters.zone);
      params = params.set('sortBy', filters.sortBy || 'latest');
    }
    
    return params;
  }
  // --- Get Recent Listings ---
  getRecentListings(limit: number = 5): Observable<PaginatedResponse> {
    let params = new HttpParams().set('limit', limit.toString());
    return this.http.get<PaginatedResponse>(`${this.baseUrl}/api/listings/recent`, { params });
  }

  getFeaturedListings(limit: number = 10): Observable<PaginatedResponse> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<PaginatedResponse>(`${this.baseUrl}/api/listings/featured`, { params });
  }

  reportProperty(payload: any) {
    return this.http.post(`${this.baseUrl}/api/reports/submit`, payload);
  }
  deleteListing(id: number): Observable<any> {
      return this.http.delete(`${this.baseUrl}/api/listings/delete/${id}`);
    }

   // Add this inside property.service.ts
 exploreByExactCity(city: string, state: string, zone: string | null, propertyType: string | null, sortBy: string, page: number, size: number) {
    let params = new HttpParams()
      .set('city', city)
      .set('sortBy', sortBy)
      .set('page', page.toString())
      .set('size', size.toString());
      
    if (state) params = params.set('state', state);
    if (zone) params = params.set('zone', zone);
    if (propertyType) params = params.set('propertyType', propertyType);

    return this.http.get(`${this.baseUrl}/api/listings/exploreCity`, { params });
  }

  triggerPhoneAndWP(phone: any, actionType: string, prop: any) {
  const phoneStr = String(phone);
  if (actionType === 'call') {
    window.open(`tel:${phoneStr}`, '_self');
  } else {
    const cleanPhone = phoneStr.replace(/[^0-9]/g, '');
    const propertyUrl = `https://www.roomzo.in/room/${prop.id}`;
    const message = encodeURIComponent(`Hi,\n\nI found your property listing on Roomzo. I’m interested in this property and would like to know more about the rent, availability, and facilities.\n\nLooking forward to your response.\n\nRegards,\nRoomzo User\n\nProperty URL: ${propertyUrl}`);
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  }
}


updateSafetyConsent(userId: number | string, consentGiven: boolean): Observable<any> {
    // The keys MUST match the properties in your UserConsent.java Entity exactly
    const payload = { 
      userId: userId, 
      safetyConsentGiven: consentGiven 
    };
    
    return this.http.post(`${this.baseUrl}/api/consents/save`, payload);
  }

  // Add this inside property.service.ts
  checkSafetyConsent(userId: number | string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/consents/check/${userId}`);
  }

  getListingReviews(listingId: string | number): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/listings/${listingId}/reviews`);
  }

  submitListingReview(
    listingId: string | number,
    payload: { userId: number; rating: number; comment?: string }
  ): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/listings/${listingId}/reviews`, payload);
  }
}
