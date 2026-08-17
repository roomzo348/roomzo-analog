import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, from, switchMap, map, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface BillingPlan {
  code: 'plus' | 'pro';
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

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  getPlans(): Observable<{ status: number; data: { freeOwnerContacts: number; plans: BillingPlan[] } }> {
    return this.http.get<any>(`${this.baseUrl}/api/billing/plans`);
  }

  getConfig(): Observable<{ status: number; data: { keyId: string; configured: boolean; mode: string } }> {
    return this.http.get<any>(`${this.baseUrl}/api/billing/config`);
  }

  getWallet(): Observable<{ status: number; data: BillingWallet }> {
    return this.http.get<any>(`${this.baseUrl}/api/billing/me`);
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

  loadCheckoutScript(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) return Promise.resolve(false);
    if (window.Razorpay) return Promise.resolve(true);
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  checkout(planCode: string): Observable<BillingWallet> {
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
            return verifyRes.data as BillingWallet;
          })
        );
      })
    );
  }

  private openRazorpay(order: any): Promise<{
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }> {
    return this.loadCheckoutScript().then((ok) => {
      if (!ok || !window.Razorpay) {
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
      return new Promise((resolve, reject) => {
        const checkout = new window.Razorpay({
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
          config: {
            display: {
              blocks: {
                upi: {
                  name: 'UPI',
                  instruments: [
                    {
                      method: 'upi',
                      // Collect-only hid UPI after NPCI deprecated VPA entry (Feb 2026).
                      // Intent/QR show on live mobile; Collect/QR remain for test + iOS/desktop.
                      flows: ['intent', 'qr', 'collect'],
                    },
                  ],
                },
              },
              hide: [{ method: 'emi' }, { method: 'paylater' }],
              sequence: ['block.upi', 'upi', 'card', 'netbanking'],
              preferences: { show_default_blocks: true },
            },
          },
          notes: { planCode: order.plan?.code || '' },
          theme: { color: '#196153' },
          handler: (response: any) => resolve(response),
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled')),
          },
        });
        checkout.on?.('payment.failed', (response: any) => {
          const description = response?.error?.description || response?.error?.reason || 'Payment failed';
          reject(new Error(description));
        });
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
