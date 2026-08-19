import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouteMeta } from '@analogjs/router';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { authGuard } from '../../auth.guard';
import { UserProfileService, UserProfile } from '../../services/user-profile.service';
import { PropertyService } from '../../services/property.service';
import { AuthService } from '../../services/auth.service';
import { BillingService, BillingWallet } from '../../services/billing.service';
import { ContactAccessService } from '../../services/contact-access.service';
import { ListingCardComponent } from '../../components/listing-card/listing-card';
import { mapBackendListingsToUi } from '../../services/Utility';
import { environment } from '../../../environments/environment';
import { planDisplayName, paymentReturnNotice } from '../../utils/billing-return';

export const routeMeta: RouteMeta = {
  canActivate: [authGuard],
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
};

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    RouterLink,
    ListingCardComponent,
  ],
  templateUrl: './profile.html',
  styleUrls: ['./profile.css'],
})
export default class ProfilePageComponent implements OnInit, OnDestroy {
  profileForm!: FormGroup;
  userId: number | null = null;
  isLoading = true;
  isSaving = false;
  isUploadingPhoto = false;
  profileLoadWarning = '';
  viewMode: 'hub' | 'saved' = 'hub';
  isEditSidebarOpen = false;

  profile: UserProfile | null = null;
  favoriteListings: any[] = [];
  isOwner = false;
  wallet: BillingWallet | null = null;
  openingPaywall = false;
  private walletSub?: Subscription;

  profilePhotoUrl: string | null = null;
  profilePhotoPreview: string | null = null;
  pendingPhotoFile: File | null = null;
  removePhotoFlag = false;

  constructor(
    private fb: FormBuilder,
    private profileService: UserProfileService,
    private propertyService: PropertyService,
    private authService: AuthService,
    private billing: BillingService,
    private contactAccess: ContactAccessService,
    private router: Router,
    private route: ActivatedRoute,
    private toastr: ToastrService,
    private cd: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.buildForm();

    if (!isPlatformBrowser(this.platformId)) {
      this.isLoading = false;
      return;
    }

    const stored = this.getStoredUser();
    if (!stored?.id) {
      this.router.navigate(['/owner-auth'], { queryParams: { returnUrl: '/profile' } });
      return;
    }

    this.userId = parseInt(String(stored.id), 10);
    this.isOwner = localStorage.getItem('userVerifiedWithOtp') === 'true';
    this.applyProfileData(stored);
    this.isLoading = false;
    this.loadAll();
    this.notePaymentReturn();
    this.walletSub = this.billing.wallet$.subscribe((wallet) => {
      if (wallet) this.wallet = wallet;
      this.cd.detectChanges();
    });
    // Wallet is reconciled server-side on /billing/me; reload after returning
    // from checkout so the profile card does not keep showing 0.
    if (this.route.snapshot.queryParamMap.get('payment') === 'success') {
      setTimeout(() => this.loadWallet(), 400);
    }
  }

  ngOnDestroy(): void {
    this.walletSub?.unsubscribe();
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.remove('profile-sidebar-open');
    }
  }

  private getStoredUser(): any {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }

  private buildForm(): void {
    this.profileForm = this.fb.group({
      name: ['', [Validators.maxLength(120)]],
      displayName: ['', [Validators.maxLength(120)]],
      phone: ['', [Validators.pattern(/^$|^[0-9+\-\s]{10,15}$/)]],
      email: ['', [Validators.email]],
      age: [null, [Validators.min(13), Validators.max(120)]],
      address: ['', [Validators.maxLength(500)]],
      city: ['', [Validators.maxLength(150)]],
      state: ['', [Validators.maxLength(150)]],
    });
  }

  private applyProfileData(data: Partial<UserProfile>): void {
    if (!data) return;

    this.profile = { ...(this.profile ?? {}), ...data } as UserProfile;
    this.profilePhotoUrl = data.profilePhotoUrl || null;
    this.profilePhotoPreview = null;
    this.pendingPhotoFile = null;
    this.removePhotoFlag = false;

    this.profileForm.patchValue({
      name: data.name || '',
      displayName: data.displayName || '',
      phone: data.phone || '',
      email: data.email || '',
      age: data.age ?? null,
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
    });
  }

  private loadAll(): void {
    if (!this.userId) {
      return;
    }

    this.profileLoadWarning = '';

    this.profileService.getProfile(this.userId).subscribe({
      next: (res) => {
        const ok = Number(res?.status) === 1;
        if (ok && res.data) {
          this.applyProfileData(res.data);
        } else if (!ok) {
          this.profileLoadWarning =
            res?.message ||
            'Could not sync profile from server. You can still edit and try saving.';
        }
        this.cd.detectChanges();
      },
      error: () => {
        this.profileLoadWarning =
          'Profile API unavailable. If you recently deployed, run user_profile_migration.sql on the database, then restart the backend.';
        this.cd.detectChanges();
      },
    });

    this.loadFavorites();
    this.loadWallet();
  }

  private loadWallet(): void {
    this.billing.refreshWallet().subscribe({
      next: (wallet) => {
        if (wallet) this.wallet = wallet;
        this.cd.detectChanges();
      },
      error: () => {
        this.toastr.error('Could not load your contact balance. Refresh the page.');
        this.cd.detectChanges();
      },
    });
  }

  openPointsPaywall(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!isPlatformBrowser(this.platformId) || this.openingPaywall) return;

    this.openingPaywall = true;
    this.contactAccess.openPaywall(this.wallet ?? undefined, '/profile').subscribe({
      next: (paid) => {
        if (paid) this.loadWallet();
      },
      complete: () => {
        this.openingPaywall = false;
      },
    });
  }

  private notePaymentReturn(): void {
    const notice = paymentReturnNotice(this.route.snapshot.queryParamMap.get('payment'));
    if (!notice) return;
    this.toastr[notice.level](notice.message);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { payment: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  get remainingPoints(): number {
    if (!this.wallet) return 0;
    return Number(this.wallet.creditsRemaining || 0);
  }

  get creditsMeta(): string {
    if (!this.wallet) return 'Loading your contact balance…';
    if (this.wallet.planCode) {
      const name = planDisplayName(this.wallet.planCode);
      const points = this.remainingPoints;
      return `${name} plan · ${points} paid point${points === 1 ? '' : 's'} · never expires`;
    }
    return 'Buy a plan to view owner contacts.';
  }

  get planSummary(): string {
    if (!this.wallet) return 'Buy a plan to view owner contacts';
    if (this.wallet.planCode) {
      const name = planDisplayName(this.wallet.planCode);
      return `${name} · ${this.remainingPoints} point${this.remainingPoints === 1 ? '' : 's'} left`;
    }
    return 'Buy a plan to view owner contacts';
  }

  loadFavorites(): void {
    this.propertyService.getFavoriteProperties().subscribe({
      next: (res: any) => {
        const payload = res?.data ?? res?.favorites ?? res?.items ?? res ?? [];
        const favorites = Array.isArray(payload) ? payload : payload?.listings ?? payload?.properties ?? [];
        const normalized = favorites
          .map((item: any) => {
            const property = item?.property ?? item?.listing ?? item;
            return {
              ...property,
              id: property?.id ?? item?.propertyId ?? item?.listingId ?? item?.id,
              propertyName: property?.propertyName ?? property?.property_name ?? property?.title,
              rentAmount: property?.rentAmount ?? property?.rent_amount ?? property?.price,
              bedrooms: property?.bedrooms,
              bathrooms: property?.bathrooms,
              propertySize: property?.propertySize ?? property?.property_size ?? property?.area,
              city: property?.city,
              state: property?.state,
              photos: property?.photos ?? property?.images ?? [],
              dateCreated: property?.dateCreated ?? property?.createdOn ?? property?.created_on,
              propertyType: property?.propertyType ?? property?.property_type ?? property?.type,
            };
          })
          .filter((p: any) => p?.id);

        this.favoriteListings = mapBackendListingsToUi(normalized);
        this.cd.detectChanges();
      },
    });
  }

  get displayName(): string {
    return this.profile?.displayName || this.profile?.name || this.profile?.email || 'Your Profile';
  }

  get initials(): string {
    const label = this.displayName;
    return label ? label.charAt(0).toUpperCase() : 'U';
  }

  private readonly profileCompletionChecks: { key: keyof UserProfile | 'profilePhotoUrl'; label: string }[] = [
    { key: 'profilePhotoUrl', label: 'profile photo' },
    { key: 'name', label: 'full name' },
    { key: 'displayName', label: 'display name' },
    { key: 'phone', label: 'mobile number' },
    { key: 'age', label: 'age' },
    { key: 'city', label: 'city' },
    { key: 'state', label: 'state' },
    { key: 'address', label: 'address' },
  ];

  get profileCompletionPercent(): number {
    const snapshot = this.getCompletionProfileSnapshot();
    if (!snapshot) return 0;
    const total = this.profileCompletionChecks.length;
    const completed = this.profileCompletionChecks.filter((item) =>
      this.isProfileFieldComplete(item.key, snapshot)
    ).length;
    return Math.round((completed / total) * 100);
  }

  get profileIncompleteFields(): string[] {
    const snapshot = this.getCompletionProfileSnapshot();
    if (!snapshot) return [];
    return this.profileCompletionChecks
      .filter((item) => !this.isProfileFieldComplete(item.key, snapshot))
      .map((item) => item.label);
  }

  get profileIncompleteHint(): string {
    const missing = this.profileIncompleteFields;
    if (!missing.length) return '';
    if (missing.length === 1) return missing[0];
    if (missing.length === 2) return `${missing[0]} and ${missing[1]}`;
    return `${missing.slice(0, 2).join(', ')} and ${missing.length - 2} more`;
  }

  private getCompletionProfileSnapshot(): Partial<UserProfile> | null {
    if (!this.profile) return null;

    if (!this.isEditSidebarOpen) {
      return this.profile;
    }

    const form = this.profileForm.getRawValue();
    let profilePhotoUrl: string | null | undefined = this.profile.profilePhotoUrl ?? null;
    if (this.removePhotoFlag) {
      profilePhotoUrl = null;
    } else if (this.profilePhotoPreview || this.profilePhotoUrl) {
      profilePhotoUrl = this.profilePhotoUrl || this.profile.profilePhotoUrl || 'pending';
    }

    return {
      ...this.profile,
      name: form.name,
      displayName: form.displayName,
      phone: form.phone,
      age: form.age,
      city: form.city,
      state: form.state,
      address: form.address,
      profilePhotoUrl,
    };
  }

  private isProfileFieldComplete(
    key: keyof UserProfile | 'profilePhotoUrl',
    source: Partial<UserProfile>
  ): boolean {
    const value = source[key as keyof UserProfile];

    if (key === 'age') {
      return value != null && Number(value) > 0;
    }

    if (key === 'name') {
      const name = String(value ?? '').trim();
      if (!name) return false;
      const email = String(source.email ?? '').trim();
      return !email || name.toLowerCase() !== email.toLowerCase();
    }

    if (value == null) {
      return false;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    if (typeof value === 'number') {
      return true;
    }

    return false;
  }

  openSavedView(): void {
    this.viewMode = 'saved';
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  openEditSidebar(): void {
    this.isEditSidebarOpen = true;
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.add('profile-sidebar-open');
    }
  }

  closeEditSidebar(): void {
    this.isEditSidebarOpen = false;
    this.profilePhotoPreview = null;
    this.pendingPhotoFile = null;
    this.removePhotoFlag = false;
    if (this.profile) {
      this.profilePhotoUrl = this.profile.profilePhotoUrl || null;
    }
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.remove('profile-sidebar-open');
    }
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toastr.warning('Please choose an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.toastr.warning('Image must be smaller than 5 MB.');
      return;
    }

    this.pendingPhotoFile = file;
    this.removePhotoFlag = false;

    const reader = new FileReader();
    reader.onload = () => {
      this.profilePhotoPreview = String(reader.result || '');
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  removePhoto(): void {
    this.pendingPhotoFile = null;
    this.profilePhotoPreview = null;
    this.profilePhotoUrl = null;
    this.removePhotoFlag = true;
  }

  onSaveProfile(): void {
    if (!this.userId || this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const { email: _email, ...payload } = this.profileForm.getRawValue();
    const ageValue = payload.age as number | string | null;
    if (ageValue === '' || ageValue == null) {
      payload.age = null;
    } else {
      payload.age = Number(ageValue);
    }

    const finalizeSave = (photoUrl: string | null | undefined) => {
      const updatePayload: Partial<UserProfile> = {
        ...payload,
        profilePhotoUrl: this.removePhotoFlag ? null : photoUrl ?? this.profilePhotoUrl ?? null,
      };

      this.profileService.updateProfile(this.userId!, updatePayload).subscribe({
        next: (res) => {
          this.isSaving = false;
          this.isUploadingPhoto = false;
          const ok = Number(res?.status) === 1;
          if (ok) {
            this.profile = res.data;
            this.applyProfileData(res.data);
            const stored = this.getStoredUser() || {};
            this.authService.saveSession({ ...stored, ...res.data });
            this.profileLoadWarning = '';
            this.toastr.success('Profile updated successfully');
            this.closeEditSidebar();
          } else {
            this.toastr.error(res?.message || 'Update failed');
          }
        },
        error: () => {
          this.isSaving = false;
          this.isUploadingPhoto = false;
          this.toastr.error('Could not save profile. Ensure DB migration is applied and backend is redeployed.');
        },
      });
    };

    if (this.pendingPhotoFile) {
      this.isUploadingPhoto = true;
      this.profileService.uploadProfilePhoto(this.pendingPhotoFile).subscribe({
        next: (res) => {
          if (!res || res.status !== 1 || !res.url) {
            this.isSaving = false;
            this.isUploadingPhoto = false;
            this.toastr.error('Photo upload failed. Try again.');
            return;
          }
          const url = res.url.startsWith('http')
            ? res.url
            : environment.hostingerUploadUrl + res.url;
          finalizeSave(url);
        },
        error: () => {
          this.isSaving = false;
          this.isUploadingPhoto = false;
          this.toastr.error('Photo upload failed. Try again.');
        },
      });
      return;
    }

    finalizeSave(this.removePhotoFlag ? null : this.profilePhotoUrl);
  }

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.toastr.success('Logged out successfully');
      this.router.navigate(['/']);
    });
  }

  viewProperty(listing: any): void {
    if (listing?.id) {
      this.router.navigate(['/room', listing.id]);
    }
  }
}
