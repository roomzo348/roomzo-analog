
import { Injectable } from '@angular/core';

import {
  HttpClient,
  HttpHeaders,
  HttpParams
} from '@angular/common/http';

import {
  Observable,
  forkJoin,
  of,
  throwError
} from 'rxjs';

import { catchError, map, tap } from 'rxjs/operators';

import { environment } from '../../environments/environment';

export interface FlatmatePostData {

  name: string;

  age: number;

  gender: string;

  profession: string;

  budget: string;

  bio: string;

  flatAddress: string;

  city: string;

  latitude: number | string | null;

  longitude: number | string | null;

  preferences: string[];

  images: string[];
}

@Injectable({
  providedIn: 'root'
})
export class FlatmateService {

  private baseUrl =
    `${environment.apiUrl}/api/flatmates`;

  private uploadUrl =
    `${environment.apiUrl || ''}/api/upload`;

  private favoriteIdsStorageKey = 'roomzo_flatmate_favorite_ids';
  readonly sampleImageUrl =
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80';

  constructor(
    private http: HttpClient
  ) {}

  // =========================================
  // MEMORY FEED
  // =========================================

  getMemoryFeed(): Observable<any> {

    return this.http.get(
      `${this.baseUrl}/memory-feed`
    );
  }

  // =========================================
  // PAGINATED NEARBY FEED
  // =========================================

  getNearbyFeed(
    page: number,
    size: number,
    lat?: number,
    lng?: number
  ): Observable<any> {

    let params = new HttpParams()
      .set('page', page)
      .set('size', size);

    // Graceful location handling
    if (
      lat != null &&
      lng != null
    ) {

      params = params
        .set('lat', lat)
        .set('lng', lng);
    }

    return this.http.get(
      `${this.baseUrl}/nearby`,
      { params }
    );
  }

  // =========================================
  // EXISTING ALL POSTS
  // =========================================

  getAllPosts(): Observable<any> {

    return this.http.get(
      this.baseUrl
    );
  }

  // =========================================
  // IMAGE UPLOADS
  // =========================================

  uploadImagesToHostinger(
    files: File[]
  ): Observable<{ urls: string[] }> {
    if (!files?.length) {
      return of({ urls: [] });
    }

    return forkJoin(files.map((file, i) => this.uploadImageStrict(file, i + 1))).pipe(
      map((urls) => ({ urls }))
    );
  }

  private uploadImageStrict(file: File, index: number): Observable<string> {
    return this.uploadImageToHostinger(file).pipe(
      map((res: any) => {
        if (!res || Number(res.status) !== 1 || !res.url) {
          throw new Error(res?.message || `Photo ${index} upload failed.`);
        }
        return this.resolveImageUrl(String(res.url));
      }),
      catchError((err) => {
        const msg =
          err?.error?.message ||
          err?.message ||
          `Photo ${index} upload failed.`;
        return throwError(() => new Error(msg));
      })
    );
  }

  private uploadImageToHostinger(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('secret_key', environment.uploadSecretKey);
    return this.http.post<any>(this.uploadUrl, formData);
  }

  // =========================================
  // AUTH HEADERS
  // =========================================

  private getHeaders(): HttpHeaders {

    const user =
      JSON.parse(
        localStorage.getItem('user') || '{}'
      );

    const userId =
      user?.id || '';

    return new HttpHeaders({

      'Content-Type':
        'application/json',

      'X-User-Id':
        userId.toString()
    });
  }

  // =========================================
  // CREATE POST
  // =========================================

  createPost(
    postData: FlatmatePostData
  ): Observable<any> {

    return this.http.post(

      this.baseUrl,

      postData,

      {
        headers: this.getHeaders()
      }
    );
  }

  // =========================================
  // USER STATUS
  // =========================================

  checkUserPostStatus():
  Observable<any> {

    return this.http.get(

      `${this.baseUrl}/check-status`,

      {
        headers: this.getHeaders()
      }
    );
  }
  // =========================================
  // DELETE POST
  // =========================================

  deletePost(postId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${postId}`, {
      headers: this.getHeaders()
    });
  }

  getFavoritePostIds(): string[] {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }
    const stored = window.localStorage.getItem(this.favoriteIdsStorageKey);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.map((id: any) => String(id)) : [];
    } catch {
      return [];
    }
  }

  extractFavoriteIdsFromPayload(payload: any): string[] {
    const list = payload?.data ?? payload?.favorites ?? payload?.items ?? payload ?? [];
    const favorites = Array.isArray(list) ? list : list?.flatmates ?? [];
    return favorites
      .map((item: any) => {
        const post = item?.flatmate ?? item?.post ?? item;
        return post?.id ?? item?.postId ?? item?.flatmatePostId ?? item?.id;
      })
      .filter((id: any) => id != null && id !== '')
      .map((id: any) => String(id));
  }

  private setFavoritePostIds(ids: string[]): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(this.favoriteIdsStorageKey, JSON.stringify(ids));
    }
  }

  isFavoritePost(postId: string | number): boolean {
    return this.getFavoritePostIds().includes(String(postId));
  }

  saveFavoritePost(postId: string | number): Observable<any> {
    if (!this.getStoredUserId()) {
      return of({ status: 0, message: 'User not logged in' });
    }
    return this.http.post(`${this.baseUrl}/favourites/save`, { postId }).pipe(
      tap((res: any) => {
        if (res?.status === 1 || res?.status === '1') {
          const next = Array.from(new Set([...this.getFavoritePostIds(), String(postId)]));
          this.setFavoritePostIds(next);
        }
      })
    );
  }

  removeFavoritePost(postId: string | number): Observable<any> {
    if (!this.getStoredUserId()) {
      return of({ status: 0, message: 'User not logged in' });
    }
    return this.http.delete(`${this.baseUrl}/favourites/remove`, {
      body: { postId }
    }).pipe(
      tap((res: any) => {
        if (res?.status === 1 || res?.status === '1') {
          this.setFavoritePostIds(this.getFavoritePostIds().filter((id) => id !== String(postId)));
        }
      })
    );
  }

  getFavoritePosts(): Observable<any> {
    if (!this.getStoredUserId()) {
      return of({ status: 0, message: 'User not logged in', data: [] });
    }
    return this.http.get(`${this.baseUrl}/favourites`).pipe(
      tap((res: any) => {
        const ids = this.extractFavoriteIdsFromPayload(res);
        this.setFavoritePostIds(ids);
      })
    );
  }

  resolveImageUrl(dbPath: string): string {
    if (!dbPath) return this.sampleImageUrl;
    if (dbPath.startsWith('http')) return dbPath;
    const baseUrl = environment.hostingerUploadUrl || 'https://roomzo.in';
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const cleanPath = dbPath.replace(/^\/+/, '');
    return `${cleanBase}/${cleanPath}`;
  }

  private getStoredUserId(): string | number | null {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user?.id || localStorage.getItem('userId') || null;
    } catch {
      return localStorage.getItem('userId');
    }
  }
}
