import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ToastrService } from 'ngx-toastr';
import { authGuard } from '../../../auth.guard';
import { RouteMeta } from '@analogjs/router';
import { PropertyService } from '../../../services/property.service';

export const routeMeta: RouteMeta = {
  canActivate: [authGuard],
  title: 'Listing queue | Roomzo admin',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
};

@Component({
  selector: 'app-admin-listings',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink],
  templateUrl: './admin-listings.html',
  styleUrls: ['./admin-listings.css'],
})
export default class AdminListingsPage implements OnInit {
  listings: any[] = [];
  status: 'pending' | 'approved' | 'rejected' = 'pending';
  loading = true;
  actingId: number | null = null;
  actingKind: 'approve' | 'reject' | null = null;
  forbidden = false;

  constructor(
    private propertyService: PropertyService,
    private toastr: ToastrService,
    private cd: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.propertyService.getAdminModerationQueue(this.status).subscribe({
      next: (res: any) => {
        this.forbidden = false;
        this.listings = res?.data ?? [];
        this.loading = false;
        this.cd.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        if (err?.status === 403 || err?.status === 401) {
          this.forbidden = true;
          this.toastr.error('Admin access required');
          this.router.navigate(['/']);
        } else {
          this.toastr.error('Could not load listing queue');
        }
        this.cd.detectChanges();
      },
    });
  }

  setStatus(status: 'pending' | 'approved' | 'rejected'): void {
    this.status = status;
    this.load();
  }

  photo(listing: any): string {
    return listing?.photos?.[0]?.photoUrl || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&q=80';
  }

  approve(listing: any): void {
    if (this.actingId != null) return;
    this.actingId = Number(listing.id);
    this.actingKind = 'approve';
    this.cd.detectChanges();
    this.propertyService.approveAdminListing(listing.id).subscribe({
      next: (res: any) => {
        this.actingId = null;
        this.actingKind = null;
        if (Number(res?.status) !== 1) {
          this.toastr.error(res?.message || 'Approve failed');
          this.cd.detectChanges();
          return;
        }
        if (res?.data?.credited) {
          this.toastr.success(`Approved and ${res.data.credits} points granted`);
        } else if (Number(res?.data?.credits) > 0) {
          this.toastr.info(`Approved. ${res.data.credits} points were already on this listing.`);
        } else {
          this.toastr.error('Listing went live, but points were not added. Use Grant points.');
        }
        this.listings = this.listings.filter((item) => Number(item.id) !== Number(listing.id));
        this.cd.detectChanges();
        this.load();
      },
      error: (err) => {
        this.actingId = null;
        this.actingKind = null;
        this.toastr.error(err?.error?.message || err?.error?.statusMessage || 'Approve failed');
        this.cd.detectChanges();
      },
    });
  }

  reject(listing: any, reason: 'duplicate' | 'not_legit'): void {
    if (this.actingId != null) return;
    this.actingId = Number(listing.id);
    this.actingKind = 'reject';
    this.cd.detectChanges();
    this.propertyService.rejectAdminListing(listing.id, reason).subscribe({
      next: (res: any) => {
        this.actingId = null;
        this.actingKind = null;
        if (Number(res?.status) !== 1) {
          this.toastr.error(res?.message || 'Reject failed');
          this.cd.detectChanges();
          return;
        }
        this.toastr.success(reason === 'duplicate' ? 'Rejected as duplicate' : 'Rejected');
        this.listings = this.listings.filter((item) => Number(item.id) !== Number(listing.id));
        this.cd.detectChanges();
        this.load();
      },
      error: () => {
        this.actingId = null;
        this.actingKind = null;
        this.toastr.error('Reject failed');
        this.cd.detectChanges();
      },
    });
  }
}
