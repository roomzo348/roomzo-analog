import { Component, NgZone, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { FlatmateService } from '../../services/flatmate.service';
import { authGuard } from '../../auth.guard';
import { RouteMeta } from '@analogjs/router';
import { Subject, Subscription } from 'rxjs'; // NEW: For Debouncing
import { debounceTime, distinctUntilChanged } from 'rxjs/operators'; // NEW: For Debouncing

export const routeMeta: RouteMeta = {
  canActivate: [authGuard],
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
};

@Component({
  selector: 'app-post-flatmate',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, HttpClientModule],
  templateUrl: './post-flatmate.html',
  styleUrls: ['./post-flatmate.css']
}) 
export default class PostFlatmateComponent implements OnInit, OnDestroy {
  postForm: FormGroup;
  isSubmitting = false;
  isDetectingLocation = false;
  
  // Location States
  isLoadingPincode = false;
  addressSuggestions: Array<{ display_name: string; lat: string; lon: string; address?: any }> = [];

  // Search Debounce Subject
  private searchSubject = new Subject<string>();
  private searchSubscription!: Subscription;

  // Arrays
  selectedFiles: File[] = [];
  previewUrls: string[] = [];
  preferences: string[] = [];
  locationDetected: boolean = false;

  predefinedHabits: string[] = [
    'UPSC/SSC Aspirant', 'Pure Veg', 'Non-Veg Allowed', 'Quiet/Study Vibe', 
    'Early Riser', 'Night Owl', 'Non-Smoker', 'Fitness Enthusiast', 'Working Professional'
  ];

  constructor(
    private fb: FormBuilder,
    private flatmateService: FlatmateService,
    private toastr: ToastrService,
    private router: Router,
    private zone: NgZone,
    private http: HttpClient
  ) {
    this.postForm = this.fb.group({
      name: ['', Validators.required],
      phoneNumber: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]], 
      age: ['', [Validators.required, Validators.min(18), Validators.max(99)]],
      gender: ['', Validators.required],
      profession: ['', Validators.required],
      budget: ['', Validators.required],
      
      flatAddress: ['', Validators.required],
      pincode: ['', [Validators.required, Validators.pattern('^[1-9][0-9]{5}$')]],
      city: ['', Validators.required],
      state: ['', Validators.required],
      
      latitude: [''],
      longitude: [''],
      bio: ['', [Validators.required, Validators.maxLength(1000)]],
      tempPreference: ['']
    });
  }

  ngOnInit() {
    // Wait for 600ms of no typing before hitting the API to avoid 429 Too Many Requests
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(600), 
      distinctUntilChanged()
    ).subscribe(query => {
      this.performAddressSearch(query);
    });
  }

  ngOnDestroy() {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  private updateState(key: string, value: any) {
    setTimeout(() => {
      this.zone.run(() => {
        (this as any)[key] = value;
      });
    });
  }

  // --- Autosuggest Search (Trigger) ---
  onAddressSearch(event: Event) {
    const query = (event.target as HTMLInputElement).value;
    // Push the typing event to RxJS instead of making an API call instantly
    this.searchSubject.next(query); 
  }

  // --- Autosuggest Search (Actual API Call) ---
  private performAddressSearch(query: string) {
    if (query.length > 2) {
      this.http.get<any[]>(`https://nominatim.openstreetmap.org/search`, {
        params: {
          q: query,
          format: 'json',
          addressdetails: '1', 
          limit: '5',
          countrycodes: 'in'
        }
      }).subscribe({
        next: (results) => {
          this.updateState('addressSuggestions', results || []);
        },
        error: () => {
          this.updateState('addressSuggestions', []);
        }
      });
    } else {
      this.updateState('addressSuggestions', []);
    }
  }

  // --- Select Suggestion (Auto-fills everything) ---
  // --- Select Suggestion (Auto-fills everything) ---
  selectSuggestion(item: any) {
    const addr = item.address || {};
    
    // Extract exact details
    const detectedPincode = addr.postcode || '';
    const detectedState = addr.state || '';
    const detectedCity = addr.city || addr.town || addr.village || addr.state_district || '';

    // Create a clean local address (excluding state/country/pincode to avoid long strings)
    const localParts = [
      addr.amenity,
      addr.building,
      addr.residential,
      addr.neighbourhood,
      addr.suburb,
      addr.road
    ].filter(Boolean);
    
    const localAddress = localParts.length > 0 ? localParts.join(', ') : item.display_name;

    this.postForm.patchValue({
      flatAddress: localAddress,
      city: detectedCity,
      state: detectedState,
      pincode: detectedPincode,
      latitude: item.lat,
      longitude: item.lon
    });
    
    // NEW: Clear the array directly to close the dropdown instantly
    this.addressSuggestions = []; 
  }

  detectLocation() {
    if (!navigator.geolocation) {
      this.toastr.error('Geolocation not supported');
      return;
    }

    this.updateState('isDetectingLocation', true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
          const data = await res.json();
          const addr = data.address || {};
          
          const detectedPincode = addr.postcode || '';
          const detectedState = addr.state || '';
          const detectedCity = addr.city || addr.town || addr.village || addr.state_district || '';
          
          const localParts = [
            addr.amenity, addr.building, addr.residential, 
            addr.neighbourhood, addr.suburb, addr.road
          ].filter(Boolean);
          
          const localAddress = localParts.length > 0 ? localParts.join(', ') : data.display_name;

          setTimeout(() => {
            this.zone.run(() => {
              this.postForm.patchValue({
                latitude: lat,
                longitude: lng,
                pincode: detectedPincode,
                city: detectedCity,
                state: detectedState,
                flatAddress: `Flat , ${localAddress}` 
              });
              this.locationDetected = true;
              this.isDetectingLocation = false;
              this.toastr.success('Location pinned! Please add your Flat No.');
            });
          });
        } catch (e) {
          this.updateState('isDetectingLocation', false);
          this.toastr.error('Failed to resolve address');
        }
      },
      () => {
        this.updateState('isDetectingLocation', false);
        this.toastr.error('Location permission denied');
      },
      { enableHighAccuracy: true }
    );
  }

  // --- Pincode Lookup (Fallback if user types manually) ---
  onPincodeChange() {
    const pin = this.postForm.get('pincode')?.value;
    if (pin && pin.length === 6 && /^[1-9][0-9]{5}$/.test(pin) && !this.postForm.get('city')?.value) {
      this.updateState('isLoadingPincode', true);
      this.http.get<any[]>(`https://api.postalpincode.in/pincode/${pin}`).subscribe({
        next: (res) => {
          this.updateState('isLoadingPincode', false);
          if (res && res[0]?.Status === 'Success' && res[0]?.PostOffice?.length > 0) {
            const office = res[0].PostOffice[0];
            const city = office.District || office.Division || office.Block;
            const state = office.State;
            this.postForm.patchValue({ city, state });
          }
        },
        error: () => {
          this.updateState('isLoadingPincode', false);
        }
      });
    }
  }

  // --- Habit Tags ---
  addPreference(event: Event) {
    event.preventDefault();
    const val = this.postForm.get('tempPreference')?.value.trim();
    if (val && !this.preferences.includes(val)) {
      this.preferences.push(val);
      this.postForm.get('tempPreference')?.setValue('');
    }
  }

  removePreference(index: number) {
    this.preferences.splice(index, 1);
  }

  togglePreference(habit: string) {
    const index = this.preferences.indexOf(habit);
    if (index > -1) {
      this.preferences.splice(index, 1);
    } else {
      if (this.preferences.length < 5) {
        this.preferences.push(habit);
      } else {
        this.toastr.warning('You can select a maximum of 5 habits', 'Limit Reached');
      }
    }
  }

  // --- Photos ---
  onFileSelected(event: any) {
    const files = event.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        if (this.selectedFiles.length >= 5) {
          this.toastr.warning('Max 5 images allowed');
          break;
        }
        this.selectedFiles.push(files[i]);
        const reader = new FileReader();
        reader.onload = (e: any) => this.previewUrls.push(e.target.result);
        reader.readAsDataURL(files[i]);
      }
    }
  }

  removeImage(index: number) {
    this.selectedFiles.splice(index, 1);
    this.previewUrls.splice(index, 1);
  }

  // --- Submission ---
  onSubmit() {
    if (this.postForm.invalid) {
      this.postForm.markAllAsTouched();
      this.toastr.error('Please fill all required fields correctly.');
      return;
    }

    this.isSubmitting = true;

    if (this.selectedFiles.length > 0) {
      this.flatmateService.uploadImagesToHostinger(this.selectedFiles).subscribe({
        next: (uploadRes: any) => {
          const imageUrls = uploadRes.urls || uploadRes; 
          this.submitFinalData(imageUrls);
        },
        error: () => {
          this.isSubmitting = false;
          this.toastr.error('Failed to upload images to server.', 'Upload Error');
        }
      });
    } else {
      this.submitFinalData([]);
    }
  }

  private submitFinalData(imageUrls: string[]) {
    const raw = this.postForm.getRawValue();

    const payload = {
      name: raw.name,
      phoneNumber: raw.phoneNumber, 
      age: raw.age,
      gender: raw.gender,
      profession: raw.profession,
      budget: String(raw.budget), 
      bio: raw.bio,
      pincode: raw.pincode, 
      state: raw.state, 
      flatAddress: raw.flatAddress,
      city: raw.city,
      latitude: raw.latitude || null,
      longitude: raw.longitude || null,
      preferences: this.preferences,
      images: imageUrls 
    };

    this.flatmateService.createPost(payload).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        if (res.status === 1 || res.status === 'success') {
          this.toastr.success('Your profile is now live!', 'Success');
          this.router.navigate(['/flatmates']);
        } else {
          this.toastr.error(res.message || 'Upload Failed', 'Error');
        }
      },
      error: () => {
        this.isSubmitting = false;
        this.toastr.error('Server error. Please try again.');
      }
    });
  }

  isInvalid(field: string): boolean {
    const control = this.postForm.get(field);
    return !!(control && control.invalid && (control.touched || control.dirty));
  }

  checkUserStatus() {
    this.flatmateService.checkUserPostStatus().subscribe({
      next: (res: any) => {
        if (res.data === true) {
          this.toastr.warning('You already have an active flatmate listing.');
          this.router.navigate(['/flatmates']);
        }
      }
    });
  }
}