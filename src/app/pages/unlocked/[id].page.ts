import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { RouteMeta } from '@analogjs/router';
import { ToastrService } from 'ngx-toastr';
import { authGuard } from '../../auth.guard';
import { ContactAccessService, OwnerContact, UnlockedListingItem } from '../../services/contact-access.service';
import { getAmenitiesMap, getListingConditionsMap } from '../../services/Utility';

export const routeMeta: RouteMeta = {
  canActivate: [authGuard],
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
};

@Component({
  selector: 'app-unlocked-details',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink],
  templateUrl: './unlocked-details.html',
  styleUrls: ['./unlocked-details.css'],
})
export default class UnlockedDetailsPageComponent implements OnInit {
  isLoading = true;
  listing: any = null;
  contact: OwnerContact | null = null;
  unlockedAt: string | null = null;
  photos: string[] = [];
  amenities: { icon: string; label: string }[] = [];
  conditions: { icon: string; label: string }[] = [];
  private listingId = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private contactAccess: ContactAccessService,
    private toastr: ToastrService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.listingId = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(this.listingId) || this.listingId <= 0) {
      this.router.navigate(['/profile'], { queryParams: { view: 'unlocked' } });
      return;
    }
    this.load();
  }

  private load(): void {
    this.contactAccess.getUnlockedListing(this.listingId).subscribe({
      next: (res) => {
        if (Number(res?.status) !== 1 || !res?.data?.listing) {
          this.handleUnavailable(res?.message);
          return;
        }
        this.applyDetail(res.data);
        this.isLoading = false;
      },
      error: () => this.handleUnavailable('Could not load this unlocked listing'),
    });
  }

  private applyDetail(data: UnlockedListingItem): void {
    this.listing = data.listing;
    this.contact = data.contact || null;
    this.unlockedAt = data.unlockedAt || null;
    const photos = (this.listing?.photos || [])
      .map((photo: any) => photo?.photoUrl || photo?.url)
      .filter(Boolean);
    this.photos = photos.length
      ? photos
      : ['https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80'];

    this.amenities = getAmenitiesMap()
      .filter((item) => Boolean(this.listing?.[item.dbKey]))
      .map((item) => ({ icon: item.icon, label: item.label }));
    if (this.listing?.electricityIncluded) {
      this.amenities.push({ icon: 'bolt', label: 'Electricity included' });
    }

    this.conditions = getListingConditionsMap()
      .filter((item) => Boolean(this.listing?.[item.dbKey]))
      .map((item) => ({ icon: item.icon, label: item.label }));
  }

  private handleUnavailable(message?: string): void {
    this.toastr.warning(message || 'Unlock this listing to see owner details');
    this.router.navigate(['/room', this.listingId]);
  }

  get title(): string {
    return this.listing?.propertyName || this.listing?.propertyType || 'Unlocked property';
  }

  get location(): string {
    const parts = [
      this.listing?.landmark,
      this.listing?.street,
      this.listing?.city,
      this.listing?.state,
    ].filter(Boolean);
    return parts.join(', ') || 'Location available';
  }

  get phone(): string | null {
    return this.contact?.propertyPhone || this.contact?.phone || this.contact?.ownerPhone || null;
  }

  formatPrice(value: number | string | null | undefined): string {
    const n = Number(value) || 0;
    return '₹' + n.toLocaleString('en-IN');
  }

  formatUnlockedAt(value?: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  callOwner(): void {
    if (!this.phone || !isPlatformBrowser(this.platformId)) return;
    window.location.href = `tel:${this.phone}`;
  }

  whatsappOwner(): void {
    if (!this.phone || !isPlatformBrowser(this.platformId)) return;
    const digits = String(this.phone).replace(/\D/g, '');
    const finalPhone = digits.length === 10 ? `91${digits}` : digits;
    window.open(`https://wa.me/${finalPhone}`, '_blank');
  }

  emailOwner(): void {
    if (!this.contact?.email || !isPlatformBrowser(this.platformId)) return;
    window.location.href = `mailto:${this.contact.email}`;
  }

  goBack(): void {
    this.router.navigate(['/profile'], { queryParams: { view: 'unlocked' } });
  }
}
