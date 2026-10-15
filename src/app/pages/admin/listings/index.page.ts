import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
  imports: [CommonModule, MatIconModule],
  templateUrl: './admin-listings.html',
  styleUrls: ['./admin-listings.css'],
})
export default class AdminListingsPage implements OnInit {
  listings: any[] = [];
  status: 'pending' | 'approved' | 'rejected' = 'pending';
  loading = true;
  actingId: number | null = null;
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
    this.actingId = listing.id;
    this.propertyService.approveAdminListing(listing.id).subscribe({
      next: (res: any) => {
        this.toastr.success(
          res?.data?.credited
            ? `Approved and ${res.data.credits} points granted`
            : 'Approved (points already granted earlier)'
        );
        this.actingId = null;
        this.load();
      },
      error: () => {
        this.actingId = null;
        this.toastr.error('Approve failed');
        this.cd.detectChanges();
      },
    });
  }

  reject(listing: any, reason: 'duplicate' | 'not_legit'): void {
    this.actingId = listing.id;
    this.propertyService.rejectAdminListing(listing.id, reason).subscribe({
      next: () => {
        this.toastr.success(reason === 'duplicate' ? 'Rejected as duplicate' : 'Rejected');
        this.actingId = null;
        this.load();
      },
      error: () => {
        this.actingId = null;
        this.toastr.error('Reject failed');
        this.cd.detectChanges();
      },
    });
  }
}
