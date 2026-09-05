import { Component, OnInit, ChangeDetectorRef } from '@angular/core'; 
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PropertyService } from '../../services/property.service';
import { ToastrService } from 'ngx-toastr';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu'; // NEW: For the dropdown
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog'; // NEW: For the dialog
import { authGuard } from '../../auth.guard'; 
import { RouteMeta } from '@analogjs/router';
import { MatDividerModule } from '@angular/material/divider';
import { ActivityService } from '../../services/activity.service';

interface ListingInsights {
  views: number;
  contacts: number;
  shares: number;
}
export const routeMeta: RouteMeta = {
  canActivate: [authGuard],
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
};

// --- NEW: Standalone Confirmation Dialog Component ---
@Component({
  selector: 'app-confirm-delete-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title style="margin-bottom: 8px;">Delete Property</h2>
    <mat-dialog-content>
      <p style="margin: 0; color: #475569;">Are you sure you want to delete this listing? This action will permanently remove the property and all its photos. It cannot be undone.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end" style="padding-bottom: 16px; padding-right: 16px;">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="warn" [mat-dialog-close]="true" style="background-color: #ef4444; color: white;">Delete</button>
    </mat-dialog-actions>
  `
})
export class ConfirmDeleteDialogComponent {}

// --- Main Component ---
@Component({
  selector: 'app-my-listings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule, 
    MatButtonModule, 
    RouterLink, 
    MatSelectModule, 
    MatMenuModule, // Added
    MatDialogModule,
    MatDividerModule
  ],
  templateUrl: './my-listings.html',
  styleUrls: ['./my-listings.css']
})
export default class MyListingsComponent implements OnInit {

  listings: any[] = [];
  favoriteListings: any[] = [];
  isLoading = true; 
  ownerId: number | null = null;
  activeTab: 'my-properties' | 'favorites' = 'my-properties';
  listingInsights: Record<number, ListingInsights> = {};
  listingIdSearch = '';

  constructor(
    private propertyService: PropertyService,
    private activityService: ActivityService,
    private router: Router,
    private route: ActivatedRoute,
    private toastr: ToastrService,
    private cd: ChangeDetectorRef,
    private dialog: MatDialog // NEW: Inject MatDialog
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const tab = params.get('tab');
      if (tab === 'favorites') {
        this.activeTab = 'favorites';
      }
    });

    const storedUser = JSON.parse(localStorage.getItem('user') || 'null'); 
    if (storedUser && storedUser.id) {
      this.ownerId = parseInt(storedUser.id, 10);
      this.loadMyListings();
      this.loadFavoriteListings();
    } else {
      this.toastr.error('User not logged in');
      this.isLoading = false; 
    }
  }

  normalizeFavoriteListing(item: any): any {
    const property = item?.property ?? item?.listing ?? item;

    return {
      ...property,
      _favoriteMeta: item,
      id: property?.id ?? item?.propertyId ?? item?.listingId ?? item?.id,
      propertyName: property?.propertyName ?? property?.property_name ?? property?.title ?? property?.name,
      rentAmount: property?.rentAmount ?? property?.rent_amount ?? property?.price ?? property?.monthlyRent,
      bedrooms: property?.bedrooms ?? property?.bedCount,
      propertySize: property?.propertySize ?? property?.property_size ?? property?.area,
      city: property?.city ?? property?.location?.city,
      state: property?.state ?? property?.location?.state,
      photos: property?.photos ?? property?.images ?? [],
      dateCreated: property?.dateCreated ?? property?.createdOn ?? property?.created_on ?? property?.postedDate,
      propertyType: property?.propertyType ?? property?.property_type ?? property?.type,
    };
  }

  loadFavoriteListings(): void {
    this.propertyService.getFavoriteProperties().subscribe({
      next: (res: any) => {
        const payload = res?.data ?? res?.favorites ?? res?.items ?? res ?? [];
        const favorites = Array.isArray(payload) ? payload : payload?.listings ?? payload?.properties ?? [];

        this.favoriteListings = favorites
          .map((item: any) => this.normalizeFavoriteListing(item))
          .filter((item: any) => item && item.id);

        if (!this.favoriteListings.length && this.propertyService.getFavoritePropertyIds().length) {
          this.favoriteListings = this.propertyService.getFavoritePropertyIds().map((id: string) => ({ id, propertyName: 'Saved property', rentAmount: 0, city: '', state: '', photos: [], propertyType: 'Property' }));
        }

        this.cd.detectChanges();
      },
      error: () => {
        this.favoriteListings = [];
        this.cd.detectChanges();
      }
    });
  }

  switchTab(tab: 'my-properties' | 'favorites'): void {
    this.activeTab = tab;
  }

  get filteredListings(): any[] {
    const q = String(this.listingIdSearch || '').trim();
    if (!q) return this.listings;
    return this.listings.filter((prop) => String(prop?.id ?? '').includes(q));
  }

  clearListingSearch(): void {
    this.listingIdSearch = '';
  }

  loadMyListings() {
    if (!this.ownerId) {
      this.isLoading = false; 
      return;
    }

    this.isLoading = true;
    
    this.propertyService.getMyListings(this.ownerId).subscribe({
      next: (res: any) => {
        this.isLoading = false; 
        if (res && res.status === 1) {
          this.listings = res.data || [];
          this.loadOwnerInsights();
        } else {
          this.toastr.warning('Could not fetch listings');
        }
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('API Error:', err);
        this.isLoading = false;
        this.toastr.error('Server error fetching listings');
        this.cd.detectChanges();
      }
    });
  }

  loadOwnerInsights(): void {
    if (!this.ownerId || !this.listings.length) {
      return;
    }

    this.activityService.getOwnerMetrics(this.ownerId, 90).subscribe({
      next: (res: any) => {
        const properties = res?.data?.properties;
        if (Number(res?.status) === 1 && Array.isArray(properties)) {
          this.applyInsightsFromRows(properties);
        }
        this.cd.detectChanges();
      },
      error: () => {
        this.listingInsights = {};
        this.cd.detectChanges();
      },
    });
  }

  private applyInsightsFromRows(properties: any[]): void {
    const map: Record<number, ListingInsights> = {};
    for (const item of properties) {
      const propertyId = Number(item?.propertyId);
      if (!propertyId) {
        continue;
      }
      map[propertyId] = {
        views: Number(item?.views ?? 0),
        contacts: Number(item?.contacts ?? 0),
        shares: Number(item?.shares ?? 0),
      };
    }
    this.listingInsights = map;
  }

  getListingInsights(propertyId: number | string): ListingInsights {
    const id = Number(propertyId);
    return this.listingInsights[id] ?? { views: 0, contacts: 0, shares: 0 };
  }

  editProperty(id: number) {
    this.router.navigate(['/edit-listing', id]);
  }

  // --- NEW: Delete Logic ---
  deleteProperty(id: number) {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // User clicked "Delete"
        this.propertyService.deleteListing(id).subscribe({
          next: (res: any) => {
            if (res.status === 1) {
              // Remove immediately from UI array
              this.listings = this.listings.filter(p => p.id !== id);
              this.toastr.success('Listing deleted successfully');
              this.cd.detectChanges();
            } else {
              this.toastr.error(res.message || 'Failed to delete listing');
            }
          },
          error: (err) => {
            console.error('Delete error:', err);
            this.toastr.error('Server error while deleting property');
          }
        });
      }
    });
  }
  
  formatPrice(price: number): string {
    return '₹' + (price ? price.toLocaleString() : '0');
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'RENTED': return 'badge-rented';
      case 'EXPIRED': return 'badge-expired';
      case 'HIDDEN': return 'badge-hidden';
      default: return 'badge-active';
    }
  }

  changeStatus(property: any, event: any) {
    const newStatus = event.value; 
    const originalStatus = property.isRented; 
    property.isRented = newStatus; 

    this.propertyService.updateListingStatus(property.id, newStatus).subscribe({
      next: (res) => {
        this.toastr.success(`Status updated successfully`);
        this.cd.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        property.isRented = originalStatus; 
        this.toastr.error('Failed to update status on server');
        console.error(err);
        this.cd.detectChanges();
      }
    });
  }

  getStatusLabel(status: any): string {
    const code = Number(status); 
    if (code === 1) return 'RENTED';
    if (code === 2) return 'HIDDEN';
    if (code === 3) return 'EXPIRED';
    return 'ACTIVE'; 
  }

  formatPostedDate(dateString?: string): string {
    if (!dateString) return 'Added recently';

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'Added recently';

    return (
      'Added ' +
      date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    );
  }
}