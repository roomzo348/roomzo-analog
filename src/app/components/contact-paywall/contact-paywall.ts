import { Component, Inject, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { Subscription, take } from 'rxjs';
import { BillingService, BillingPlan, BillingWallet } from '../../services/billing.service';

export type ContactPaywallResult = 'paid' | 'cancelled' | 'failed';

@Component({
  selector: 'app-contact-paywall',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './contact-paywall.html',
  styleUrls: ['./contact-paywall.css'],
})
export class ContactPaywallComponent implements OnInit, OnDestroy {
  private readonly fallbackPlans: BillingPlan[] = [
    {
      code: 'starter',
      name: 'Starter',
      tagline: 'Start with 4 owner contacts',
      amountPaise: 1900,
      amountRupees: 19,
      currency: 'INR',
      contacts: 4,
      durationDays: 30,
      popular: false,
      features: ['4 Property Contacts', 'Direct Owner Contact', 'No Brokerage'],
      priceLabel: '₹19/month',
    },
    {
      code: 'plus',
      name: 'Plus',
      tagline: 'For focused house hunting',
      amountPaise: 4900,
      amountRupees: 49,
      currency: 'INR',
      contacts: 10,
      durationDays: 30,
      popular: false,
      features: ['10 Property Contacts', 'Direct Owner Contact', 'New Listing Alerts', 'No Brokerage'],
      priceLabel: '₹49/month',
    },
    {
      code: 'pro',
      name: 'Pro',
      tagline: 'Most popular for serious seekers',
      amountPaise: 9900,
      amountRupees: 99,
      currency: 'INR',
      contacts: 25,
      durationDays: 30,
      popular: true,
      features: [
        '25 Property Contacts',
        'Direct Owner Contact',
        'New Listing Alerts',
        'No Brokerage',
        'Full-time WhatsApp & call support',
      ],
      priceLabel: '₹99/month',
    },
  ];

  plans: BillingPlan[] = [];
  payingCode: string | null = null;
  selectedCode: string | null = null;
  configured = true;
  errorMessage = '';
  private checkoutOpenedSub?: Subscription;

  constructor(
    public dialogRef: MatDialogRef<ContactPaywallComponent, ContactPaywallResult>,
    @Inject(MAT_DIALOG_DATA) public data: Partial<BillingWallet> & { plans?: BillingPlan[]; returnUrl?: string },
    private billing: BillingService,
    private toastr: ToastrService,
    private zone: NgZone
  ) {
    this.plans = this.withPlanDefaults(data?.plans || []);
    if (!this.plans.length) {
      this.billing.getPlans().subscribe({
        next: (res) => {
          this.plans = this.withPlanDefaults(res?.data?.plans || []);
          this.ensureSelection();
        },
      });
    }
    this.billing.getConfig().subscribe({
      next: (res) => {
        this.configured = Boolean(res?.data?.configured);
      },
    });
  }

  ngOnInit(): void {
    this.togglePageChrome(true);
    this.ensureSelection();
    // Warm the Razorpay script while the user reads the plans so tapping Pay
    // opens checkout immediately instead of stalling on a script download.
    void this.billing.loadCheckoutScript();
  }

  ngOnDestroy(): void {
    this.checkoutOpenedSub?.unsubscribe();
    this.togglePageChrome(false);
    this.toggleCheckoutMode(false);
  }

  private togglePageChrome(open: boolean): void {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('roomzo-paywall-open', open);
  }

  /** Hides this dialog while the Razorpay checkout sheet is on screen. */
  private toggleCheckoutMode(open: boolean): void {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('roomzo-checkout-open', open);
  }

  /**
   * Razorpay callbacks can land while Angular is mid-check. Deferring to a
   * microtask inside the zone keeps updates out of that pass, which would
   * otherwise trip NG0100 and loop change detection.
   */
  private applyAfterCheck(action: () => void): void {
    this.zone.run(() => {
      Promise.resolve().then(action);
    });
  }

  get displayPlans(): BillingPlan[] {
    const list = this.plans.length ? this.plans : this.fallbackPlans;
    const order = ['starter', 'plus', 'pro'];
    return [...list].sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
  }

  get selectedPlan(): BillingPlan | null {
    const list = this.displayPlans;
    return list.find((plan) => plan.code === this.selectedCode) || null;
  }

  isSelected(plan: BillingPlan): boolean {
    return plan.code === this.selectedCode;
  }

  select(plan: BillingPlan, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.payingCode) return;
    this.selectedCode = plan.code;
    this.errorMessage = '';
  }

  perContact(plan: BillingPlan): string {
    if (!plan.contacts) return String(plan.amountRupees);
    const each = plan.amountRupees / plan.contacts;
    if (each >= 10) return String(Math.round(each));
    return each.toFixed(2).replace(/\.?0+$/, '');
  }

  ctaLabel(): string {
    if (this.payingCode) return 'Opening checkout…';
    const plan = this.selectedPlan;
    if (!plan) return 'Select a plan above';
    return `Pay ₹${plan.amountRupees} · ${plan.name}`;
  }

  paySelected(event?: Event): void {
    const plan = this.selectedPlan;
    if (!plan) return;
    if (!this.configured) {
      this.errorMessage = 'Payment gateway is not configured yet. Please contact support.';
      return;
    }
    this.pay(plan, event);
  }

  private ensureSelection(): void {
    const list = this.displayPlans;
    if (!list.length) return;
    if (list.some((plan) => plan.code === this.selectedCode)) return;
    this.selectedCode = (list.find((plan) => plan.popular) || list[0]).code;
  }

  close(): void {
    this.dialogRef.close('cancelled');
  }

  private withPlanDefaults(plans: BillingPlan[]): BillingPlan[] {
    if (!plans?.length) return [];
    return plans.map((plan) => {
      const fallback = this.fallbackPlans.find((item) => item.code === plan.code);
      return {
        ...fallback,
        ...plan,
        tagline: plan.tagline || fallback?.tagline || '',
        features: plan.features?.length ? plan.features : fallback?.features || [],
      };
    });
  }

  pay(plan: BillingPlan, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.payingCode) return;
    this.payingCode = plan.code;
    this.errorMessage = '';
    // Keep the button loader visible until Razorpay is actually on screen,
    // then step this dialog aside so the payment sheet is usable.
    this.checkoutOpenedSub?.unsubscribe();
    this.checkoutOpenedSub = this.billing.checkoutOpened$
      .pipe(take(1))
      .subscribe(() => this.toggleCheckoutMode(true));
    // Do NOT pass returnUrl — this is a dialog flow, not a redirect flow.
    // Passing a returnUrl would cause billing service to store it and
    // navigate away after payment instead of just closing the dialog.
    this.billing.checkout(plan.code).subscribe({
      next: () => {
        this.applyAfterCheck(() =>
          this.finishCheckout(
            'paid',
            'success',
            `${plan.name} plan activated! Tap "View Contact" to unlock.`
          )
        );
      },
      error: (err) => {
        this.applyAfterCheck(() => {
          const message = err?.error?.message || err?.message || 'Payment was not completed';
          // Razorpay never opened, so keep the dialog and let the user retry.
          if (message === 'Payment already in progress') {
            this.payingCode = null;
            this.toggleCheckoutMode(false);
            return;
          }
          if (message === 'Payment cancelled') {
            this.finishCheckout('cancelled', 'info', 'Payment cancelled. No credits were added.');
            return;
          }
          this.finishCheckout('failed', 'error', message);
        });
      },
    });
  }

  /**
   * Every outcome of a started checkout closes this dialog and reports through a
   * toast, so the user lands back on the page they came from instead of facing
   * the plan sheet again.
   */
  private finishCheckout(
    result: ContactPaywallResult,
    level: 'success' | 'info' | 'error',
    message: string
  ): void {
    this.payingCode = null;
    this.checkoutOpenedSub?.unsubscribe();
    // Checkout mode stays on until ngOnDestroy so the dialog cannot flash back
    // between Razorpay closing and this dialog finishing its close animation.
    this.toastr[level](message);
    this.dialogRef.close(result);
  }
}
