import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  Subject,
  BehaviorSubject,
  from,
  switchMap,
  map,
  throwError,
  finalize,
  catchError,
} from 'rxjs';
import { environment } from '../../environments/environment';
import {
  BILLING_RETURN_KEY,
  PaymentReturnStatus,
  sanitizeBillingReturnUrl,
  withPaymentStatus,
} from '../utils/billing-return';

export interface BillingPlan {
  code: 'starter' | 'plus' | 'pro';
  name: string;
  tagline: string;
  amountPaise: number;
  amountRupees: number;
  originalAmountRupees?: number;
  offerLabel?: string;
  currency: string;
  contacts: number;
  durationDays: number;
  popular: boolean;
  features: string[];
  priceLabel: string;
}

export interface BillingWallet {
  creditsRemaining: number;
  freeUnlockAvailable: boolean;
  planCode: string | null;
  planExpiresAt: string | null;
  planActive: boolean;
  unlockedListingIds?: number[];
  plans?: BillingPlan[];
}

type CashfreeCheckoutResult = {
  error?: { message?: string; code?: string };
  redirect?: boolean;
  paymentDetails?: { paymentMessage?: string };
};

type CashfreeInstance = {
  checkout: (options: Record<string, unknown>) => Promise<CashfreeCheckoutResult>;
};

declare global {
  interface Window {
    Cashfree?: (options: { mode: 'sandbox' | 'production' }) => CashfreeInstance;
  }
}

@Injectable({ providedIn: 'root' })
export class BillingService {
  private baseUrl = environment.apiUrl;
  private checkoutLock = false;
  private scriptPromise: Promise<boolean> | null = null;

  /** Emits once the Cashfree checkout sheet is about to appear on screen. */
  readonly checkoutOpened$ = new Subject<void>();

  private readonly walletSubject = new BehaviorSubject<BillingWallet | null>(null);
  /** Live wallet balance — updated after unlock, payment, or refreshWallet(). */
  readonly wallet$ = this.walletSubject.asObservable();

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  rememberReturnUrl(url?: string | null): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const safe = sanitizeBillingReturnUrl(url);
    if (!safe || safe === '/pricing' || safe.startsWith('/pricing?')) return;
    sessionStorage.setItem(BILLING_RETURN_KEY, safe);
  }

  peekReturnUrl(): string {
    if (!isPlatformBrowser(this.platformId)) return '';
    return sanitizeBillingReturnUrl(sessionStorage.getItem(BILLING_RETURN_KEY));
  }

  clearReturnUrl(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    sessionStorage.removeItem(BILLING_RETURN_KEY);
  }

  consumeReturnUrl(status?: PaymentReturnStatus, fallback = '/pricing'): string {
    if (!isPlatformBrowser(this.platformId)) return fallback;
    const stored = sanitizeBillingReturnUrl(sessionStorage.getItem(BILLING_RETURN_KEY));
    sessionStorage.removeItem(BILLING_RETURN_KEY);
    const dest = stored && stored !== '/pricing' && !stored.startsWith('/pricing?') ? stored : fallback;
    if (!dest) return '';
    return status ? withPaymentStatus(dest, status) : dest;
  }

  getPlans(): Observable<{ status: number; data: { freeOwnerContacts: number; plans: BillingPlan[] } }> {
    return this.http.get<any>(`${this.baseUrl}/api/billing/plans`);
  }

  getConfig(): Observable<{
    status: number;
    data: { configured: boolean; mode: string; provider?: string };
  }> {
    return this.http.get<any>(`${this.baseUrl}/api/billing/config`);
  }

  getWallet(): Observable<{ status: number; data: BillingWallet }> {
    return this.http.get<any>(`${this.baseUrl}/api/billing/me`);
  }

  /** Push a wallet snapshot to every subscriber (profile, pricing, etc.). */
  publishWallet(wallet: Partial<BillingWallet>): void {
    const current = this.walletSubject.value;
    this.walletSubject.next({
      creditsRemaining: wallet.creditsRemaining ?? current?.creditsRemaining ?? 0,
      freeUnlockAvailable: wallet.freeUnlockAvailable ?? current?.freeUnlockAvailable ?? false,
      planCode: wallet.planCode !== undefined ? wallet.planCode : (current?.planCode ?? null),
      planExpiresAt:
        wallet.planExpiresAt !== undefined ? wallet.planExpiresAt : (current?.planExpiresAt ?? null),
      planActive: wallet.planActive ?? (Number(wallet.creditsRemaining ?? current?.creditsRemaining ?? 0) > 0),
      unlockedListingIds: wallet.unlockedListingIds ?? current?.unlockedListingIds,
      plans: wallet.plans ?? current?.plans,
    });
  }

  /** Fetch the latest balance from the server and broadcast it. */
  refreshWallet(): Observable<BillingWallet | null> {
    return this.getWallet().pipe(
      map((res) => {
        if (Number(res?.status) === 1 && res.data) {
          this.walletSubject.next(res.data);
          return res.data;
        }
        return null;
      })
    );
  }

  createOrder(planCode: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/billing/orders`, { planCode });
  }

  verifyPayment(payload: { orderId: string; paymentId?: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/billing/verify`, payload);
  }

  /**
   * Loads the Cashfree checkout script once. Memoised so preloading (on paywall
   * open) and the actual Pay click share a single request instead of injecting
   * duplicate script tags.
   */
  loadCheckoutScript(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) return Promise.resolve(false);
    if (window.Cashfree) return Promise.resolve(true);
    if (this.scriptPromise) return this.scriptPromise;

    this.scriptPromise = new Promise<boolean>((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        this.scriptPromise = null;
        resolve(false);
      };
      document.body.appendChild(script);
    });
    return this.scriptPromise;
  }

  checkout(planCode: string, returnUrl?: string | null): Observable<BillingWallet> {
    if (this.checkoutLock) {
      return throwError(() => new Error('Payment already in progress'));
    }
    this.checkoutLock = true;
    this.rememberReturnUrl(returnUrl);
    return this.createOrder(planCode).pipe(
      switchMap((res) => {
        if (res?.status !== 1 || !res.data?.orderId || !res.data?.paymentSessionId) {
          return throwError(() => new Error(res?.message || 'Could not start payment'));
        }
        return from(this.openCashfree(res.data)).pipe(
          switchMap((payload) => this.verifyPayment(payload)),
          map((verifyRes) => {
            if (verifyRes?.status !== 1) {
              throw new Error(verifyRes?.message || 'Payment verification failed');
            }
            const wallet = verifyRes.data as BillingWallet;
            this.walletSubject.next(wallet);
            return wallet;
          })
        );
      }),
      catchError((err) => {
        let message: string =
          err?.error?.message ||
          (err instanceof Error ? err.message : '') ||
          'Could not start payment';
        if (
          message.includes('UNABLE_TO_VERIFY') ||
          message.includes('certificate') ||
          message.includes('ECONNREFUSED') ||
          message.includes('ENOTFOUND')
        ) {
          message = 'Could not reach payment gateway. Please check your connection and try again.';
        }
        return throwError(() => new Error(message));
      }),
      finalize(() => {
        this.checkoutLock = false;
      })
    );
  }

  private openCashfree(order: any): Promise<{ orderId: string; paymentId?: string }> {
    return this.loadCheckoutScript().then(async (ok) => {
      if (!ok || !window.Cashfree) {
        throw new Error('Could not load Cashfree checkout');
      }
      const mode = order.mode === 'production' ? 'production' : 'sandbox';
      const cashfree = window.Cashfree({ mode });
      this.checkoutOpened$.next();

      const result = await cashfree.checkout({
        paymentSessionId: order.paymentSessionId,
        redirectTarget: '_modal',
      });

      if (result?.error) {
        const msg = String(result.error.message || 'Payment cancelled');
        if (/cancel|closed|dismiss|abort/i.test(msg)) {
          throw new Error('Payment cancelled');
        }
        throw new Error(msg);
      }

      // Popup checkout resolves after the user finishes (or abandons). Always
      // confirm on the server — never trust the client alone.
      return { orderId: String(order.orderId) };
    });
  }
}
