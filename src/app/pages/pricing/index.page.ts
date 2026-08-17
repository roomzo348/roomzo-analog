import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
        'Unlock direct owner contacts on Roomzo. First contact is free. Starter is ₹19/month for 3 contacts, Plus is ₹49/month for 10, Pro is ₹99/month for 25 with full-time WhatsApp and call support.',
    },
  ],
};

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink],
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

    this.billing.rememberReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));

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

    const plan = this.route.snapshot.queryParamMap.get('plan');
    if (plan && this.auth.getCurrentUser()?.id) {
      setTimeout(() => this.startCheckout(plan), 400);
    }
  }

  startCheckout(planCode: string): void {
    if (!this.isBrowser) return;
    if (!this.auth.getCurrentUser()?.id) {
      this.router.navigate(['/owner-auth'], {
        queryParams: { returnUrl: `/pricing?plan=${planCode}` },
      });
      return;
    }
    if (!this.configured) {
      this.toastr.info('Add Razorpay test Key ID and Key Secret to enable sandbox checkout.');
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
        const cancelled = message === 'Payment cancelled';
        this.leavePricing(cancelled ? 'cancelled' : 'failed', cancelled ? undefined : message);
      },
    });
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
