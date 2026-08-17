import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of, switchMap, catchError, map } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { BillingWallet } from './billing.service';
import { ContactPaywallComponent, ContactPaywallResult } from '../components/contact-paywall/contact-paywall';

export interface OwnerContact {
  name: string;
  phone: string | null;
  propertyPhone: string | null;
  ownerPhone: string | null;
  email: string | null;
}

export interface UnlockResult {
  unlocked: boolean;
  unlockType?: string;
  contact?: OwnerContact;
  creditsRemaining?: number;
  freeUnlockAvailable?: boolean;
  planCode?: string | null;
  code?: string;
  plans?: any[];
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ContactAccessService {
  private baseUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private dialog: MatDialog,
    private router: Router,
    private toastr: ToastrService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  isLoggedIn(): boolean {
    return Boolean(this.auth.getCurrentUser()?.id);
  }

  unlock(listingId: number): Observable<{ status: number; code?: string; message: string; data: UnlockResult }> {
    return this.http.post<any>(`${this.baseUrl}/api/contacts/unlock`, { listingId });
  }

  getStatus(listingId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/contacts/status`, { params: { listingId } });
  }

  requestOwnerContact(listingId: number, returnUrl?: string): Observable<UnlockResult | null> {
    if (!isPlatformBrowser(this.platformId)) return of(null);
    if (!this.isLoggedIn()) {
      this.router.navigate(['/owner-auth'], {
        queryParams: { returnUrl: returnUrl || this.router.url },
      });
      return of(null);
    }

    return this.unlock(listingId).pipe(
      switchMap((res) => {
        if (res?.status === 1 && res.data?.unlocked) {
          return of(res.data as UnlockResult);
        }
        if (res?.code === 'PAYMENT_REQUIRED' || res?.data?.unlocked === false) {
          return this.openPaywall(res?.data).pipe(
            switchMap((paid) => (paid ? this.unlock(listingId).pipe(map((retry) => retry?.data as UnlockResult)) : of(null)))
          );
        }
        this.toastr.error(res?.message || 'Could not unlock owner contact');
        return of(null);
      }),
      catchError((err) => {
        if (err?.status === 401) {
          this.router.navigate(['/owner-auth'], {
            queryParams: { returnUrl: returnUrl || this.router.url },
          });
          return of(null);
        }
        this.toastr.error(err?.error?.message || 'Could not unlock owner contact');
        return of(null);
      })
    );
  }

  openPaywall(wallet?: Partial<BillingWallet> & { plans?: any[] }): Observable<boolean> {
    const ref = this.dialog.open(ContactPaywallComponent, {
      width: '640px',
      maxWidth: '94vw',
      maxHeight: '92vh',
      autoFocus: false,
      panelClass: 'roomzo-paywall-panel',
      data: wallet || {},
    });
    return ref.afterClosed().pipe(
      map((result: ContactPaywallResult | undefined) => result === 'paid')
    );
  }
}
