import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap, map, catchError } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private baseUrl = environment.apiUrl;
  private isLoggedInSubject = new BehaviorSubject<boolean>(this.checkInitialStatus());
  isLoggedIn$ = this.isLoggedInSubject.asObservable();
  private sessionCheckInFlight = false;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router
  ) {}

  private checkInitialStatus(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('userVerifiedWithOtp') === 'true';
    }
    return false;
  }

  sendOtp(email: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/auth/send-otp`, { phone: email });
  }

  verifyOtp(email: string, otp: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/auth/verify-otp`, { phone: email, otp });
  }

  saveSession(user: any): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('userVerifiedWithOtp', 'true');
      localStorage.setItem('userEmail', user.email || user.phone || '');
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('loginTimestamp', Date.now().toString());
    }
    this.isLoggedInSubject.next(true);
  }

  clearLocalSession(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('userVerifiedWithOtp');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('loginTimestamp');
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
    this.isLoggedInSubject.next(false);
  }

  logout(): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/auth/logout`, {}).pipe(
      tap(() => this.clearLocalSession()),
      catchError(() => {
        this.clearLocalSession();
        return of({ status: 1 });
      })
    );
  }

  handleSessionExpired(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.clearLocalSession();
    if (!this.router.url.startsWith('/owner-auth')) {
      this.router.navigate(['/owner-auth'], {
        queryParams: { returnUrl: this.router.url, reason: 'session-expired' },
      });
    }
  }

  validateSession(): Observable<boolean> {
    if (!isPlatformBrowser(this.platformId)) {
      return of(true);
    }

    return this.http.get<any>(`${this.baseUrl}/api/auth/me`).pipe(
      map((res) => {
        if (res?.status === 1 && res?.data) {
          this.saveSession(res.data);
          return true;
        }
        this.clearLocalSession();
        return false;
      }),
      catchError(() => {
        this.clearLocalSession();
        return of(false);
      })
    );
  }

  refreshSessionIfNeeded(): void {
    if (!isPlatformBrowser(this.platformId) || this.sessionCheckInFlight) return;
    if (localStorage.getItem('userVerifiedWithOtp') !== 'true') return;

    this.sessionCheckInFlight = true;
    this.validateSession().subscribe({
      complete: () => {
        this.sessionCheckInFlight = false;
      },
      error: () => {
        this.sessionCheckInFlight = false;
      },
    });
  }

  getOwnerDetails(ownerId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/auth/owner-info/${ownerId}`);
  }

  sendContactForm(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/contact/send`, data);
  }

  login(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/auth/login`, payload);
  }

  completeRegistration(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/auth/register`, payload);
  }

  forgotPasswordInit(identifier: string) {
    return this.http.post<any>(`${this.baseUrl}/api/auth/forgot-password-init`, { identifier });
  }

  resetPassword(payload: any) {
    return this.http.post<any>(`${this.baseUrl}/api/auth/reset-password`, payload);
  }

  getCurrentUser(): any | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }

  hasStoredSession(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    return localStorage.getItem('userVerifiedWithOtp') === 'true' && Boolean(this.getCurrentUser()?.id);
  }
}
