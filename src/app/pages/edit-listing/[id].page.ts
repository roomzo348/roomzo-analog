import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ReactiveFormsModule,
  FormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormArray,
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PropertyService } from '../../services/property.service';
import { ToastrService } from 'ngx-toastr';
import { authGuard } from '../../auth.guard';
import { RouteMeta } from '@analogjs/router';

export const routeMeta: RouteMeta = {
  canActivate: [authGuard],
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
};

@Component({
  selector: 'app-edit-listing',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatIconModule, MatButtonModule],
  templateUrl: './edit-listing.html',
  styleUrls: ['./edit-listing.css'],
})
export default class EditListingComponent implements OnInit {
  listingId: string | null = null;
  isLoading = true;
  isSaving = false;
  isUploading = false;

  editForm: FormGroup;

  existingPhotoUrls: string[] = [];
  newImagePreviews: string[] = [];
  newWatermarkedFiles: File[] = [];
  newOriginalFiles: File[] = [];

  propertyTypes = [
    { label: 'Flat', icon: 'home', value: 'Flat' },
    { label: 'PG', icon: 'apartment', value: 'PG' },
    { label: 'Rooms', icon: 'hotel', value: 'Room' },
  ];

  amenityGroups = [
    {
      title: 'Room Essentials',
      items: [
        { label: 'Bed & Mattress', formControlName: 'bed', icon: 'bed' },
        { label: 'Almirah / Cupboard', formControlName: 'almirah', icon: 'door_sliding' },
        { label: 'Study Table & Chair', formControlName: 'studyTable', icon: 'desk' },
        { label: 'Fan & Tube Light', formControlName: 'fanLight', icon: 'mode_fan' },
      ],
    },
    {
      title: 'Appliances & Utilities',
      items: [
        { label: 'RO Water Purifier', formControlName: 'roWater', icon: 'water_drop' },
        { label: 'Inverter (Power Backup)', formControlName: 'inverter', icon: 'battery_charging_full' },
        { label: 'AC / Air Cooler', formControlName: 'cooling', icon: 'ac_unit' },
        { label: 'Geyser (Hot Water)', formControlName: 'geyser', icon: 'hot_tub' },
        { label: 'Kitchen Access', formControlName: 'kitchen', icon: 'kitchen' },
      ],
    },
    {
      title: 'Shared Facilities & Safety',
      items: [
        { label: 'Wi-Fi Internet', formControlName: 'wifi', icon: 'wifi' },
        { label: 'Parking Space', formControlName: 'parking', icon: 'local_parking' },
        { label: 'CCTV Security', formControlName: 'cctv', icon: 'videocam' },
        { label: 'Washing Machine', formControlName: 'washingMachine', icon: 'local_laundry_service' },
      ],
    },
  ];

  listingConditions = [
    { label: 'Couple Friendly', formControlName: 'coupleFriendly', icon: 'favorite' },
    { label: 'For Boys', formControlName: 'forBoys', icon: 'male' },
    { label: 'For Girls', formControlName: 'forGirls', icon: 'female' },
    { label: '24×7 Water', formControlName: 'water24x7', icon: 'water_drop' },
    { label: 'Veg Only', formControlName: 'vegOnly', icon: 'restaurant' },
    { label: 'Family Friendly', formControlName: 'familyFriendly', icon: 'family_restroom' },
    { label: 'Students Only', formControlName: 'studentsOnly', icon: 'school' },
    { label: 'Working Professionals', formControlName: 'workingProfessionals', icon: 'work' },
  ];

  commonRules = [
    { label: 'No Smoking', value: 'no_smoking', icon: 'smoke_free' },
    { label: 'No Parties', value: 'no_parties', icon: 'celebration' },
    { label: 'Quiet Hours (10PM - 7AM)', value: 'quiet_hours', icon: 'bedtime' },
    { label: 'No Shoes Inside', value: 'no_shoes', icon: 'do_not_step' },
    { label: 'Check-in after 2PM', value: 'check_in_time', icon: 'schedule' },
  ];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private propertyService: PropertyService,
    private toastr: ToastrService,
    private cd: ChangeDetectorRef
  ) {
    this.editForm = this.buildForm();
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.listingId = idParam ? String(idParam) : null;

    if (this.listingId) {
      this.loadListingData();
    } else {
      this.toastr.error('Invalid Listing ID');
      this.router.navigate(['/my-listings']);
    }
  }

  private buildForm(): FormGroup {
    return this.fb.group({
      details: this.fb.group({
        propertyType: ['', Validators.required],
        bedrooms: [1, [Validators.required, Validators.min(0)]],
        bathrooms: [1, [Validators.required, Validators.min(0)]],
        propertySize: ['', Validators.required],
        address: this.fb.group({
          street: ['', Validators.required],
          landmark: ['', Validators.required],
          city: ['', Validators.required],
          state: ['', Validators.required],
          zip: ['', Validators.required],
          latitude: [null],
          longitude: [null],
        }),
      }),
      amenities: this.fb.group({
        bed: [false],
        almirah: [false],
        studyTable: [false],
        fanLight: [false],
        roWater: [false],
        inverter: [false],
        cooling: [false],
        geyser: [false],
        wifi: [false],
        parking: [false],
        cctv: [false],
        washingMachine: [false],
        kitchen: [false],
      }),
      conditions: this.fb.group({
        coupleFriendly: [false],
        forBoys: [false],
        forGirls: [false],
        water24x7: [false],
        vegOnly: [false],
        familyFriendly: [false],
        studentsOnly: [false],
        workingProfessionals: [false],
      }),
      guidebook: this.fb.group({
        rules: this.fb.array([]),
        customRules: [''],
        nearby: this.fb.array([]),
      }),
      final: this.fb.group({
        name: ['', [Validators.required, Validators.maxLength(200)]],
        contactNo: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
        description: ['', [Validators.required, Validators.maxLength(1000)]],
        rentAmount: ['', Validators.required],
      }),
    });
  }

  get detailsGroup(): FormGroup {
    return this.editForm.get('details') as FormGroup;
  }
  get amenitiesGroup(): FormGroup {
    return this.editForm.get('amenities') as FormGroup;
  }
  get conditionsGroup(): FormGroup {
    return this.editForm.get('conditions') as FormGroup;
  }
  get guidebookGroup(): FormGroup {
    return this.editForm.get('guidebook') as FormGroup;
  }
  get finalGroup(): FormGroup {
    return this.editForm.get('final') as FormGroup;
  }
  get nearbyPlaces(): FormArray {
    return this.guidebookGroup.get('nearby') as FormArray;
  }
  get rulesArray(): FormArray {
    return this.guidebookGroup.get('rules') as FormArray;
  }

  get totalPhotoCount(): number {
    return this.existingPhotoUrls.length + this.newImagePreviews.length;
  }

  loadListingData(): void {
    this.isLoading = true;
    this.propertyService.getListingById(String(this.listingId)).subscribe({
      next: (res: any) => {
        this.isLoading = false;

        if (res.status === 1 && res.data) {
          this.patchFormFromListing(res.data);
        } else {
          this.toastr.error('Listing not found');
          this.router.navigate(['/my-listings']);
        }

        this.cd.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.toastr.error('Error loading listing');
        this.cd.detectChanges();
      },
    });
  }

  private patchFormFromListing(data: any): void {
    const description = data.description
      ? data.description
          .split('|')
          .map((line: string) => line.trim())
          .filter((line: string) => line.length > 0)
          .join('\n')
      : '';

    const contactNo = data.tempContactNo != null ? String(data.tempContactNo) : '';

    this.detailsGroup.patchValue({
      propertyType: data.propertyType || '',
      bedrooms: data.bedrooms ?? 1,
      bathrooms: data.bathrooms ?? 1,
      propertySize: data.propertySize ?? '',
      address: {
        street: data.street || '',
        landmark: data.landmark || '',
        city: data.city || '',
        state: data.state || '',
        zip: data.zipCode || '',
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      },
    });

    this.amenitiesGroup.patchValue({
      bed: !!data.hasBed,
      almirah: !!data.hasAlmirah,
      studyTable: !!data.hasStudyTable,
      fanLight: !!data.hasFanLight,
      roWater: !!data.hasRoWater,
      inverter: !!data.hasInverter,
      cooling: !!data.hasCooling,
      geyser: !!data.hasGeyser,
      wifi: !!data.hasWifi,
      parking: !!data.hasParking,
      cctv: !!data.hasCctv,
      washingMachine: !!data.hasWashingMachine,
      kitchen: !!data.hasKitchen,
    });

    this.conditionsGroup.patchValue({
      coupleFriendly: !!data.coupleFriendly,
      forBoys: !!data.forBoys,
      forGirls: !!data.forGirls,
      water24x7: !!data.water24x7,
      vegOnly: !!data.vegOnly,
      familyFriendly: !!data.familyFriendly,
      studentsOnly: !!data.studentsOnly,
      workingProfessionals: !!data.workingProfessionals,
    });

    this.finalGroup.patchValue({
      name: data.propertyName || '',
      contactNo,
      description,
      rentAmount: data.rentAmount ?? '',
    });

    this.existingPhotoUrls = Array.isArray(data.photos)
      ? data.photos.map((p: any) => (typeof p === 'string' ? p : p.photoUrl)).filter(Boolean)
      : [];

    this.rulesArray.clear();
    const rules = data.guidebook?.rules || [];
    rules.forEach((r: any) => {
      const value = typeof r === 'string' ? r : r?.ruleText;
      if (value) this.rulesArray.push(this.fb.control(value));
    });

    this.guidebookGroup.patchValue({
      customRules: data.guidebook?.customRules || '',
    });

    this.nearbyPlaces.clear();
    const nearby = data.guidebook?.nearbyPlaces || data.guidebook?.nearby || [];
    if (nearby.length > 0) {
      nearby.forEach((place: any) => this.nearbyPlaces.push(this.createNearbyGroup(place)));
    } else {
      this.addNearbyPlace();
    }
  }

  private createNearbyGroup(place?: any): FormGroup {
    return this.fb.group({
      name: [place?.name || '', Validators.required],
      distance: [place?.distance || '', Validators.required],
      type: [place?.type || 'place'],
    });
  }

  toggleRule(ruleValue: string): void {
    const index = this.rulesArray.controls.findIndex((x) => x.value === ruleValue);
    if (index === -1) {
      this.rulesArray.push(this.fb.control(ruleValue));
    } else {
      this.rulesArray.removeAt(index);
    }
  }

  isRuleSelected(ruleValue: string): boolean {
    return this.rulesArray.controls.some((x) => x.value === ruleValue);
  }

  addNearbyPlace(): void {
    this.nearbyPlaces.push(this.createNearbyGroup());
  }

  removeNearbyPlace(index: number): void {
    if (this.nearbyPlaces.length > 1) {
      this.nearbyPlaces.removeAt(index);
    }
  }

  updateCounter(controlName: string, change: number): void {
    const control = this.detailsGroup.get(controlName);
    if (control) {
      const newValue = (control.value || 0) + change;
      if (newValue >= 0) control.setValue(newValue);
    }
  }

  removeExistingPhoto(index: number): void {
    this.existingPhotoUrls.splice(index, 1);
  }

  removeNewPhoto(index: number): void {
    this.newImagePreviews.splice(index, 1);
    this.newWatermarkedFiles.splice(index, 1);
    this.newOriginalFiles.splice(index, 1);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    this.isUploading = true;

    try {
      for (const file of Array.from(files)) {
        const dotIndex = file.name.lastIndexOf('.');
        const baseName = dotIndex !== -1 ? file.name.substring(0, dotIndex) : file.name;
        const extension = dotIndex !== -1 ? file.name.substring(dotIndex) : '';
        const orgFileName = `${baseName}-org${extension}`;
        const originalFile = new File([file], orgFileName, { type: file.type });
        const watermarkedFile = await this.watermarkImage(file);

        this.newOriginalFiles.push(originalFile);
        this.newWatermarkedFiles.push(watermarkedFile);
        this.newImagePreviews.push(await this.readFileAsDataURL(watermarkedFile));
      }
      this.cd.detectChanges();
    } catch {
      this.toastr.error('Failed to process images.');
    } finally {
      this.isUploading = false;
      input.value = '';
      this.cd.detectChanges();
    }
  }

  onSubmit(): void {
    if (this.isSaving) return;

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.toastr.warning('Please complete all required fields.');
      return;
    }

    if (this.totalPhotoCount < 2) {
      this.toastr.error('Please keep at least 2 photos in your listing.');
      return;
    }

    this.isSaving = true;
    const raw = this.editForm.value;

    const payload = {
      details: raw.details,
      amenities: raw.amenities,
      conditions: raw.conditions,
      guidebook: {
        rules: raw.guidebook.rules,
        customRules: raw.guidebook.customRules,
        nearby: raw.guidebook.nearby,
      },
      final: {
        name: raw.final.name,
        contactNo: raw.final.contactNo,
        rentAmount: raw.final.rentAmount,
        description: raw.final.description
          ? raw.final.description
              .split(/\r?\n/)
              .map((line: string) => line.trim())
              .filter((line: string) => line.length > 0)
              .join(' | ')
          : '',
      },
      photos: this.existingPhotoUrls,
    };

    this.propertyService
      .updateListing(this.listingId!, payload, this.newWatermarkedFiles, this.newOriginalFiles)
      .subscribe({
        next: (res: any) => {
          this.isSaving = false;
          if (res.status === 1) {
            this.toastr.success('Property updated successfully');
            this.router.navigate(['/my-listings']);
          } else {
            this.toastr.error(res.message || 'Update failed');
          }
          this.cd.detectChanges();
        },
        error: () => {
          this.isSaving = false;
          this.toastr.error('Server error during update');
          this.cd.detectChanges();
        },
      });
  }

  cancel(): void {
    this.router.navigate(['/my-listings']);
  }

  private readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private watermarkImage(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (readerEvent: ProgressEvent<FileReader>) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          const fontSize = Math.floor(canvas.width * 0.12);
          ctx.font = `bold ${fontSize}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 3;
          ctx.shadowOffsetY = 3;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((-30 * Math.PI) / 180);
          ctx.fillText('Roomzo.in', 0, 0);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Canvas toBlob failed'));
                return;
              }
              resolve(new File([blob], file.name, { type: file.type }));
            },
            file.type,
            0.92
          );
        };
        img.onerror = reject;
        img.src = readerEvent.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}
