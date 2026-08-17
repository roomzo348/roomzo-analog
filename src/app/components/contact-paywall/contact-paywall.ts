import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { BillingService, BillingPlan, BillingWallet } from '../../services/billing.service';

export type ContactPaywallResult = 'paid' | 'cancelled' | 'failed';

@Component({
  selector: 'app-contact-paywall',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './contact-paywall.html',
  styleUrls: ['./contact-paywall.css'],
})
export class ContactPaywallComponent {
  plans: BillingPlan[] = [];
  payingCode: string | null = null;
  configured = true;
  errorMessage = '';

  constructor(
    public dialogRef: MatDialogRef<ContactPaywallComponent, ContactPaywallResult>,
    @Inject(MAT_DIALOG_DATA) public data: Partial<BillingWallet> & { plans?: BillingPlan[]; returnUrl?: string },
    private billing: BillingService,
    private toastr: ToastrService,
    private router: Router
  ) {
    this.plans = data?.plans || [];
    if (!this.plans.length) {
      this.billing.getPlans().subscribe({
        next: (res) => {
          this.plans = res?.data?.plans || [];
        },
      });
    }
    this.billing.getConfig().subscribe({
      next: (res) => {
        this.configured = Boolean(res?.data?.configured);
      },
    });
  }

  close(): void {
    this.dialogRef.close('cancelled');
  }

  pay(plan: BillingPlan): void {
    if (this.payingCode) return;
    if (!this.configured) {
      this.toastr.info('Razorpay sandbox keys are not configured yet. Add test Key ID and Key Secret to enable checkout.');
      return;
    }
    this.payingCode = plan.code;
    this.errorMessage = '';
    this.billing.checkout(plan.code).subscribe({
      next: () => {
        this.toastr.success(`${plan.name} is active. This property will stay unlocked for you.`);
        this.billing.clearReturnUrl();
        this.dialogRef.close('paid');
      },
      error: (err) => {
        this.payingCode = null;
        const message = err?.message || 'Payment was not completed';
        if (message === 'Payment cancelled') {
          this.errorMessage = 'Payment was cancelled. Choose a plan to try again.';
          this.toastr.info(this.errorMessage);
          return;
        }
        this.errorMessage = message;
        this.toastr.error(message);
      },
    });
  }

  viewAllPlans(): void {
    const returnUrl = this.data?.returnUrl || this.router.url;
    this.billing.rememberReturnUrl(returnUrl);
    this.dialogRef.close('cancelled');
    this.router.navigate(['/pricing'], { queryParams: { returnUrl } });
  }
}
