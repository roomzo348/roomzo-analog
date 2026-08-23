import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of, switchMap, catchError, map, finalize, tap, share, Subject } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { BillingService, BillingWallet } from './billing.service';
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
  creditsSpent?: number;
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
  private paywallOpen = false;
  /** Coalesce concurrent unlock calls for the same listing (double-tap / race). */
  private inflightUnlocks = new Map<number, Observable<UnlockResult | null>>();
  /** Lets pages drop button spinners the moment the plan dialog is on screen. */
  readonly paywallOpened$ = new Subject<void>();

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private billing: BillingService,
    private dialog: MatDialog,
    private router: Router,
    private toastr: ToastrService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  isLoggedIn(): boolean {
    return Boolean(this.auth.getCurrentUser()?.id);
  }

  isPaywallOpen(): boolean {
    return this.paywallOpen;
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

    const existing = this.inflightUnlocks.get(listingId);
    if (existing) return existing;

    const request$ = this.unlock(listingId).pipe(
      switchMap((res) => {
        if (res?.status === 1 && res.data?.unlocked && res.data?.contact) {
          return of(res.data as UnlockResult);
        }
        if (res?.code === 'PAYMENT_REQUIRED' || res?.data?.unlocked === false) {
          return this.openPaywall(res?.data, returnUrl || this.router.url).pipe(
            switchMap((paid) =>
              paid
                ? this.unlock(listingId).pipe(
                    map((retry) =>
                      retry?.status === 1 && retry?.data?.unlocked ? (retry.data as UnlockResult) : null
                    )
                  )
                : of(null)
            )
          );
        }
        this.toastr.error(res?.message || 'Could not unlock owner contact');
        return of(null);
      }),
      tap((result) => this.noteUnlockOutcome(result)),
      catchError((err) => {
        if (err?.status === 401) {
          this.router.navigate(['/owner-auth'], {
            queryParams: { returnUrl: returnUrl || this.router.url },
          });
          return of(null);
        }
        this.toastr.error(err?.error?.message || 'Could not unlock owner contact');
        return of(null);
      }),
      finalize(() => {
        this.inflightUnlocks.delete(listingId);
      }),
      share({ resetOnRefCountZero: true })
    );

    this.inflightUnlocks.set(listingId, request$);
    return request$;
  }

  private noteUnlockOutcome(result: UnlockResult | null): void {
    if (!result?.unlocked || typeof result.creditsRemaining !== 'number') return;

    this.billing.publishWallet({
      creditsRemaining: result.creditsRemaining,
      planCode: result.planCode ?? null,
      planActive: result.creditsRemaining > 0,
    });

    const left = result.creditsRemaining;
    const leftLabel = `${left} credit${left === 1 ? '' : 's'} left`;

    if (result.unlockType === 'credit' || result.creditsSpent === 1) {
      this.toastr.success(`1 credit used · ${leftLabel}`);
      return;
    }
    if (result.unlockType === 'already') {
      this.toastr.info(`Already unlocked · ${leftLabel} (no charge)`);
    }
  }

  openPaywall(wallet?: Partial<BillingWallet> & { plans?: any[] }, returnUrl?: string): Observable<boolean> {
    if (this.paywallOpen) {
      return of(false);
    }
    this.paywallOpen = true;
    const mobile = isPlatformBrowser(this.platformId) && window.innerWidth < 860;
    const ref = this.dialog.open(ContactPaywallComponent, {
      width: mobile ? '100%' : '880px',
      maxWidth: mobile ? '100vw' : '94vw',
      maxHeight: mobile ? '88vh' : 'none',
      autoFocus: false,
      restoreFocus: false,
      hasBackdrop: true,
      disableClose: false,
      panelClass: mobile ? ['roomzo-paywall-panel', 'roomzo-paywall-sheet'] : 'roomzo-paywall-panel',
      position: mobile ? { bottom: '0px' } : undefined,
      data: { ...(wallet || {}), returnUrl: returnUrl || this.router.url },
    });
    // Dialog is open — stop parent "Opening…" spinners so they don't spin under the sheet.
    this.paywallOpened$.next();
    return ref.afterClosed().pipe(
      finalize(() => {
        this.paywallOpen = false;
      }),
      map((result: ContactPaywallResult | undefined) => result === 'paid')
    );
  }
}