import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { RouteMeta } from '@analogjs/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../services/auth.service';
import { BillingService, BillingPlan, BillingWallet } from '../../services/billing.service';

export const routeMeta: RouteMeta = {
  title: 'Roomzo Plans | Plus ₹49 & Pro ₹99',
  meta: [
    {
      name: 'description',
      content:
        'Unlock direct owner contacts on Roomzo. First contact is free. Plus is ₹49/month for 10 contacts. Pro is ₹99/month for 25 contacts. Unlocked properties stay open.',
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
        this.toastr.success('Payment successful. Your contact credits are ready.');
      },
      error: (err) => {
        this.payingCode = null;
        const message = err?.message || 'Payment was not completed';
        if (message !== 'Payment cancelled') {
          this.toastr.error(message);
        }
      },
    });
  }
}
