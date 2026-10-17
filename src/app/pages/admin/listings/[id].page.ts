import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ToastrService } from 'ngx-toastr';
import { authGuard } from '../../../auth.guard';
import { RouteMeta } from '@analogjs/router';
import { PropertyService } from '../../../services/property.service';

export const routeMeta: RouteMeta = {
  canActivate: [authGuard],
  title: 'Review listing | Roomzo admin',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
};

@Component({
  selector: 'app-admin-listing-review',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './admin-listing-review.html',
  styleUrls: ['./admin-listing-review.css'],
})
export default class AdminListingReviewPage implements OnInit {
  listing: any = null;
  loading = true;
  forbidden = false;
  acting: 'approve' | 'reject' | null = null;
  activePhoto = '';
  zoomOpen = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private propertyService: PropertyService,
    private toastr: ToastrService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading = false;
      return;
    }
    this.propertyService.getAdminListingReview(id).subscribe({
      next: (res: any) => {
        this.listing = res?.data ?? null;
        this.activePhoto = this.photos[0] || '';
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
          this.toastr.error('Could not load listing for review');
        }
        this.cd.detectChanges();
      },
    });
  }

  get photos(): string[] {
    const list = Array.isArray(this.listing?.photos) ? this.listing.photos : [];
    return list.map((p: any) => p?.photoUrl || p).filter(Boolean);
  }

  get addressLine(): string {
    return [this.listing?.street, this.listing?.landmark, this.listing?.city, this.listing?.state, this.listing?.zipCode]
      .filter(Boolean)
      .join(', ') || '—';
  }

  get mapLink(): string | null {
    const lat = Number(this.listing?.latitude);
    const lng = Number(this.listing?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  selectPhoto(url: string): void {
    this.activePhoto = url;
  }

  openZoom(url: string): void {
    this.activePhoto = url;
    this.zoomOpen = true;
  }

  closeZoom(): void {
    this.zoomOpen = false;
  }

  approve(): void {
    if (!this.listing || this.acting) return;
    this.acting = 'approve';
    this.propertyService.approveAdminListing(this.listing.id).subscribe({
      next: (res: any) => {
        this.acting = null;
        if (Number(res?.status) !== 1) {
          this.toastr.error(res?.message || 'Approve failed');
          this.cd.detectChanges();
          return;
        }
        this.toastr.success(
          res?.data?.credited
            ? `Approved and ${res.data.credits} points granted`
            : 'Listing approved'
        );
        this.router.navigate(['/admin/listings']);
      },
      error: (err) => {
        this.acting = null;
        this.toastr.error(err?.error?.message || 'Approve failed');
        this.cd.detectChanges();
      },
    });
  }

  reject(reason: 'duplicate' | 'not_legit'): void {
    if (!this.listing || this.acting) return;
    this.acting = 'reject';
    this.propertyService.rejectAdminListing(this.listing.id, reason).subscribe({
      next: (res: any) => {
        this.acting = null;
        if (Number(res?.status) !== 1) {
          this.toastr.error(res?.message || 'Reject failed');
          this.cd.detectChanges();
          return;
        }
        this.toastr.success(reason === 'duplicate' ? 'Rejected as duplicate' : 'Rejected');
        this.router.navigate(['/admin/listings']);
      },
      error: () => {
        this.acting = null;
        this.toastr.error('Reject failed');
        this.cd.detectChanges();
      },
    });
  }
}
