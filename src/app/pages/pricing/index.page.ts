import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { RouteMeta } from '@analogjs/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../services/auth.service';
import { BillingService, BillingPlan, BillingWallet } from '../../services/billing.service';
import { PaymentReturnStatus, paymentReturnNotice } from '../../utils/billing-return';

export const routeMeta: RouteMeta = {
  title: 'Roomzo Plans | Starter ₹19, Plus ₹49 & Pro ₹99',
  meta: [
    {
      name: 'description',
      content:
        'Unlock owner contacts on Roomzo. Starter is ₹19 for 4 contacts, Plus is ₹49 for 11, and Pro is ₹99 for 25 with WhatsApp chat support.',
    },
  ],
};

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './pricing.html',
  styleUrls: ['./pricing.css'],
})
export default class PricingPageComponent implements OnInit {
  plans: BillingPlan[] = [];
  wallet: BillingWallet | null = null;
  configured = true;
  mode = 'unset';
  payingCode: string | null = null;
  loading = true;
  isBrowser = isPlatformBrowser(this.platformId);

  constructor(
    private billing: BillingService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.billing.getPlans().subscribe({
      next: (res) => {
        this.plans = res?.data?.plans || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });

    if (!this.isBrowser) return;

    this.billing.rememberReturnUrl(
      this.route.snapshot.queryParamMap.get('returnUrl') || this.previousInAppUrl()
    );

    this.billing.getConfig().subscribe({
      next: (res) => {
        this.configured = Boolean(res?.data?.configured);
        this.mode = res?.data?.mode || 'unset';
      },
    });

    if (this.auth.getCurrentUser()?.id) {
      this.billing.getWallet().subscribe({
        next: (res) => {
          this.wallet = res?.data || null;
        },
      });
    }

    const orderId = this.route.snapshot.queryParamMap.get('order_id');
    const paymentStatus = this.route.snapshot.queryParamMap.get('payment');
    if (orderId && this.auth.getCurrentUser()?.id) {
      this.billing.verifyPayment({ orderId }).subscribe({
        next: (res) => {
          if (Number(res?.status) === 1 && res.data) {
            this.wallet = res.data;
            this.leavePricing('success');
          } else {
            this.leavePricing('failed', res?.message || 'Payment could not be confirmed');
          }
        },
        error: () => this.leavePricing('failed', 'Payment could not be confirmed'),
      });
    } else if (paymentStatus) {
      const notice = paymentReturnNotice(paymentStatus);
      if (notice) this.toastr[notice.level](notice.message);
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { payment: null, order_id: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }

    const plan = this.route.snapshot.queryParamMap.get('plan');
    if (plan && this.auth.getCurrentUser()?.id && !orderId) {
      setTimeout(() => this.startCheckout(plan), 400);
    }
  }

  startCheckout(planCode: string): void {
    if (!this.isBrowser) return;
    if (this.payingCode) return;
    if (!this.auth.getCurrentUser()?.id) {
      this.router.navigate(['/owner-auth'], {
        queryParams: { returnUrl: `/pricing?plan=${planCode}` },
      });
      return;
    }
    if (!this.configured) {
      this.toastr.info('Add Cashfree App ID and Secret Key to enable sandbox checkout.');
      return;
    }
    this.payingCode = planCode;
    this.billing.checkout(planCode).subscribe({
      next: (wallet) => {
        this.wallet = wallet;
        this.payingCode = null;
        this.leavePricing('success');
      },
      error: (err) => {
        this.payingCode = null;
        const message = err?.message || 'Payment was not completed';
        if (message === 'Payment already in progress') return;
        const cancelled = message === 'Payment cancelled';
        this.leavePricing(cancelled ? 'cancelled' : 'failed', cancelled ? undefined : message);
      },
    });
  }

  /**
   * Where the user was before landing on pricing, so checkout can send them back
   * even when they arrived without an explicit returnUrl.
   */
  private previousInAppUrl(): string {
    const previous = this.router.lastSuccessfulNavigation()?.previousNavigation?.finalUrl;
    return previous ? this.router.serializeUrl(previous) : '';
  }

  private leavePricing(status: PaymentReturnStatus, errorMessage?: string): void {
    const destination = this.billing.consumeReturnUrl(status, '');
    if (destination) {
      this.router.navigateByUrl(destination);
      return;
    }
    if (errorMessage) {
      this.toastr.error(errorMessage);
      return;
    }
    const notice = paymentReturnNotice(status);
    if (notice) this.toastr[notice.level](notice.message);
  }
}
