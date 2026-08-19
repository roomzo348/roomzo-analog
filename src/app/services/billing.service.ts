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
import { AuthService } from './auth.service';
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

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on?: (event: string, handler: (response: any) => void) => void;
    };
  }
}

@Injectable({ providedIn: 'root' })
export class BillingService {
  private baseUrl = environment.apiUrl;
  private checkoutLock = false;
  private scriptPromise: Promise<boolean> | null = null;

  /** Emits once the Razorpay sheet is about to appear on screen. */
  readonly checkoutOpened$ = new Subject<void>();

  private readonly walletSubject = new BehaviorSubject<BillingWallet | null>(null);
  /** Live wallet balance — updated after unlock, payment, or refreshWallet(). */
  readonly wallet$ = this.walletSubject.asObservable();

  constructor(
    private http: HttpClient,
    private auth: AuthService,
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

  getConfig(): Observable<{ status: number; data: { keyId: string; configured: boolean; mode: string } }> {
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

  verifyPayment(payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/billing/verify`, payload);
  }

  /**
   * Loads the Razorpay checkout script once. Memoised so preloading (on paywall
   * open) and the actual Pay click share a single request instead of injecting
   * duplicate script tags.
   */
  loadCheckoutScript(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) return Promise.resolve(false);
    if (window.Razorpay) return Promise.resolve(true);
    if (this.scriptPromise) return this.scriptPromise;

    this.scriptPromise = new Promise<boolean>((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
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
        if (res?.status !== 1 || !res.data?.orderId) {
          return throwError(() => new Error(res?.message || 'Could not start payment'));
        }
        return from(this.openRazorpay(res.data)).pipe(
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

  private openRazorpay(order: any): Promise<{
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }> {
    return this.loadCheckoutScript().then((ok) => {
      const RazorpayCheckout = window.Razorpay;
      if (!ok || !RazorpayCheckout) {
        throw new Error('Could not load Razorpay checkout');
      }
      const user = this.auth.getCurrentUser();
      const contact = this.indianMobile(order.prefill?.contact || user?.phone || '');
      const isTest =
        order.mode === 'test' || String(order.keyId || '').startsWith('rzp_test_');
      const prefill: Record<string, string> = {
        name: order.prefill?.name || user?.displayName || user?.name || '',
        email: order.prefill?.email || user?.email || '',
        contact,
      };
      if (isTest) {
        // Test-mode UPI Collect VPA. Live checkout never prefills this.
        prefill['vpa'] = 'success@razorpay';
      }
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      // Same UPI block on mobile and desktop — mobile previously used default
      // blocks only, which often hid UPI in Razorpay test checkout.
      const upiFlows = isMobile ? (['intent', 'collect'] as const) : (['intent', 'qr', 'collect'] as const);
      const display = {
        blocks: {
          upi: {
            name: 'UPI',
            instruments: [{ method: 'upi', flows: [...upiFlows] }],
          },
        },
        hide: [{ method: 'emi' }, { method: 'paylater' }, { method: 'wallet' }],
        sequence: ['block.upi', 'upi', 'card', 'netbanking'],
        preferences: { show_default_blocks: true },
      };
      return new Promise((resolve, reject) => {
        const checkout = new RazorpayCheckout({
          key: order.keyId,
          amount: order.amount,
          currency: 'INR',
          name: 'Roomzo',
          description: `${order.plan?.name || 'Plan'} — ${order.plan?.contacts || ''} owner contacts`,
          order_id: order.orderId,
          prefill,
          method: {
            upi: true,
            card: true,
            netbanking: true,
            wallet: false,
            emi: false,
            paylater: false,
          },
          config: { display },
          notes: { planCode: order.plan?.code || '' },
          theme: { color: '#196153' },
          // These settle outside Angular's zone on purpose. Subscribers
          // re-enter the zone themselves, which keeps state updates out of
          // an in-flight change detection pass (NG0100).
          handler: (response: any) => resolve(response),
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled')),
          },
        });
        checkout.on?.('payment.failed', (response: any) => {
          const description = response?.error?.description || response?.error?.reason || 'Payment failed';
          reject(new Error(description));
        });
        this.checkoutOpened$.next();
        checkout.open();
      });
    });
  }

  private indianMobile(raw: string): string {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.length >= 10) return digits.slice(-10);
    return '';
  }
}
