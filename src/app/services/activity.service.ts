import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../environments/environment';

/**
 * Client for the backend activity-log / analytics API (`/api/activity/*`).
 *
 * All tracking calls are best-effort and fire-and-forget: they are SSR-safe,
 * swallow errors, and must never block or break the primary user action.
 */
@Injectable({ providedIn: 'root' })
export class ActivityService {
  private baseUrl = environment.apiUrl;
  private isBrowser: boolean;
  private readonly sessionKey = 'roomzo_session_id';
  private readonly viewDedupKey = 'roomzo_view_dedup';
  private readonly viewDedupTtlMs = 30 * 60 * 1000;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  // ------------------------------------------------------------- TRACKING API

  logPropertyView(propertyId: string | number, extra: Record<string, any> = {}): void {
    if (this.isDuplicateView(propertyId)) {
      return;
    }
    this.markViewLogged(propertyId);
    this.fireAndForget({ eventType: 'PROPERTY_VIEW', propertyId, ...extra });
  }

  logPropertyContact(
    propertyId: string | number,
    contactMethod: 'call' | 'whatsapp' | 'modal' | 'email' | string,
    extra: Record<string, any> = {}
  ): void {
    this.fireAndForget({ eventType: 'PROPERTY_CONTACT', propertyId, contactMethod, ...extra });
  }

  logPropertyShare(propertyId: string | number, extra: Record<string, any> = {}): void {
    this.fireAndForget({ eventType: 'PROPERTY_SHARE', propertyId, ...extra });
  }

  logSearch(params: { city?: string; state?: string; zone?: string; searchQuery?: string; [k: string]: any }): void {
    this.fireAndForget({ eventType: 'SEARCH', ...params });
  }

  /** Generic escape hatch for any custom event type. */
  logEvent(eventType: string, payload: Record<string, any> = {}): void {
    this.fireAndForget({ eventType, ...payload });
  }

  // --------------------------------------------------------------- ANALYTICS

  getMostViewed(limit = 10, days?: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/activity/analytics/most-viewed`, {
      params: this.buildParams({ limit, days })
    });
  }

  getMostContacted(limit = 10, days?: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/activity/analytics/most-contacted`, {
      params: this.buildParams({ limit, days })
    });
  }

  getMostShared(limit = 10, days?: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/activity/analytics/most-shared`, {
      params: this.buildParams({ limit, days })
    });
  }

  getTopAreas(event: 'SEARCH' | 'PROPERTY_VIEW' = 'SEARCH', limit = 10, days?: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/activity/analytics/top-areas`, {
      params: this.buildParams({ event, limit, days })
    });
  }

  getSummary(days?: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/activity/analytics/summary`, {
      params: this.buildParams({ days })
    });
  }

  getOwnerMetrics(ownerId: string | number, days?: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/activity/analytics/owner/${ownerId}`, {
      params: this.buildParams({ days })
    });
  }

  getPropertyMetrics(propertyId: string | number, days?: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/activity/analytics/property/${propertyId}`, {
      params: this.buildParams({ days })
    });
  }

  getUserActivity(userId: string | number, limit = 20, days?: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/activity/user/${userId}`, {
      params: this.buildParams({ limit, days })
    });
  }

  getUserInsights(userId: string | number, limit = 5, days?: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/activity/user/${userId}/insights`, {
      params: this.buildParams({ limit, days })
    });
  }

  // ----------------------------------------------------------------- INTERNAL

  private fireAndForget(payload: Record<string, any>): void {
    if (!this.isBrowser) return;

    const body = {
      userId: this.getUserId(),
      sessionId: this.getSessionId(),
      referrer: typeof document !== 'undefined' ? document.referrer : undefined,
      ...payload
    };

    this.http
      .post(`${this.baseUrl}/api/activity/log`, body)
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  private getUserId(): number | null {
    if (!this.isBrowser) return null;
    try {
      const user = JSON.parse(window.localStorage.getItem('user') || 'null');
      return user?.id ?? null;
    } catch {
      return null;
    }
  }

  /** Stable anonymous identifier so we can measure reach for logged-out visitors. */
  private getSessionId(): string | null {
    if (!this.isBrowser || !window.localStorage) return null;
    try {
      let sid = window.localStorage.getItem(this.sessionKey);
      if (!sid) {
        sid = this.generateId();
        window.localStorage.setItem(this.sessionKey, sid);
      }
      return sid;
    } catch {
      return null;
    }
  }

  private generateId(): string {
    try {
      if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return (crypto as any).randomUUID();
      }
    } catch {
      /* fall through */
    }
    return 'sess-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  private buildParams(obj: Record<string, any>): Record<string, string> {
    const params: Record<string, string> = {};
    Object.keys(obj).forEach((key) => {
      const val = obj[key];
      if (val !== undefined && val !== null && val !== '') {
        params[key] = String(val);
      }
    });
    return params;
  }

  /** One view log per property per browser session every 30 minutes (cuts DB writes). */
  private isDuplicateView(propertyId: string | number): boolean {
    if (!this.isBrowser) return false;
    const id = String(propertyId);
    const now = Date.now();
    const map = this.readViewDedupMap();
    const last = map[id];
    return typeof last === 'number' && now - last < this.viewDedupTtlMs;
  }

  private markViewLogged(propertyId: string | number): void {
    if (!this.isBrowser) return;
    try {
      const id = String(propertyId);
      const now = Date.now();
      const map = this.readViewDedupMap();
      map[id] = now;
      const cutoff = now - this.viewDedupTtlMs;
      for (const key of Object.keys(map)) {
        if (map[key] < cutoff) {
          delete map[key];
        }
      }
      sessionStorage.setItem(this.viewDedupKey, JSON.stringify(map));
    } catch {
      /* ignore storage errors */
    }
  }

  private readViewDedupMap(): Record<string, number> {
    try {
      const raw = sessionStorage.getItem(this.viewDedupKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
}
