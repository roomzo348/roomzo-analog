import { Component, OnInit, ChangeDetectorRef, AfterViewInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormGroup, FormBuilder, Validators, FormArray, FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PropertyService } from '../../services/property.service';
import { Country, State, City } from 'country-state-city';
import { ToastrService } from 'ngx-toastr';
import { HttpClient } from '@angular/common/http';
import { authGuard } from '../../auth.guard';
import { RouteMeta } from '@analogjs/router';
import { debounceTime, distinctUntilChanged, switchMap, catchError, filter, map } from 'rxjs/operators';
import { of, forkJoin } from 'rxjs';
import { Router } from '@angular/router'; // <-- Add this import
export const routeMeta: RouteMeta = {
  canActivate: [authGuard],
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
};

// TYPE-ONLY IMPORT: Prevents Leaflet from crashing the Node.js server build
import type * as L from 'leaflet'; 

@Component({
  selector: 'app-list-property',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './list-property.html',
  styleUrls: ['./list-property.css']
})
export default class ListPropertyComponent implements OnInit, AfterViewInit {
  listingForm: FormGroup = new FormGroup({});
  currentStep = 1;
  totalSteps = 4;
  imagePreviews: string[] = [];
  selectedFiles: File[] = [];
  originalFiles: File[] = []; // Tracks the un-watermarked files
  isUploading: boolean = false;
  states: any[] = [];
  cities: any[] = [];
  selectedStateIso: string | null = null;
  readonly WATERMARK_TEXT = 'Roomzo.in';
  isSubmitting = false;

  searchControl = new FormControl('');
  searchResults: any[] = [];

  commonRules = [
    { label: 'No Smoking', value: 'no_smoking', icon: 'smoke_free' },
    { label: 'No Parties', value: 'no_parties', icon: 'celebration' },
    { label: 'Quiet Hours (10PM - 7AM)', value: 'quiet_hours', icon: 'bedtime' },
    { label: 'No Shoes Inside', value: 'no_shoes', icon: 'do_not_step' },
    { label: 'Check-in after 2PM', value: 'check_in_time', icon: 'schedule' }
  ];

  propertyTypes = [
    { label: 'Flat', icon: 'home', value: 'Flat' },
    { label: 'PG', icon: 'apartment', value: 'PG' },
    { label: 'Rooms', icon: 'hotel', value: 'Room' }
  ];

 // NEW: Tier-2 specific amenities
  amenityGroups = [
    { title: 'Room Essentials', items: [
      { label: 'Bed & Mattress', formControlName: 'bed', icon: 'bed' },
      { label: 'Almirah / Cupboard', formControlName: 'almirah', icon: 'door_sliding' },
      { label: 'Study Table & Chair', formControlName: 'studyTable', icon: 'desk' },
      { label: 'Fan & Tube Light', formControlName: 'fanLight', icon: 'mode_fan' }
    ]},
    { title: 'Appliances & Utilities', items: [
      { label: 'RO Water Purifier', formControlName: 'roWater', icon: 'water_drop' },
      { label: 'Inverter (Power Backup)', formControlName: 'inverter', icon: 'battery_charging_full' },
      { label: 'AC / Air Cooler', formControlName: 'cooling', icon: 'ac_unit' },
      { label: 'Geyser (Hot Water)', formControlName: 'geyser', icon: 'hot_tub' },
      { label: 'Kitchen Access', formControlName: 'kitchen', icon: 'kitchen' }
    ]},
    { title: 'Shared Facilities & Safety', items: [
      { label: 'Wi-Fi Internet', formControlName: 'wifi', icon: 'wifi' },
      { label: 'Parking Space', formControlName: 'parking', icon: 'local_parking' },
      { label: 'CCTV Security', formControlName: 'cctv', icon: 'videocam' },
      { label: 'Washing Machine', formControlName: 'washingMachine', icon: 'local_laundry_service' }
    ]}
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
  
  private map: L.Map | undefined;
  private marker: L.Marker | undefined;

  constructor(
    private fb: FormBuilder, 
    private propertyService: PropertyService, 
    private cd: ChangeDetectorRef,
    private toastr: ToastrService,
    private http: HttpClient,
    private router: Router, // <-- Add this line
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.listingForm = this.fb.group({
      details: this.fb.group({
        propertyType: ['', Validators.required],
        bedrooms: [1, [Validators.required, Validators.min(0)]],
        bathrooms: [1, [Validators.required, Validators.min(0)]],
        propertySize: ['', Validators.required],
        address: this.fb.group({
          street: ['', Validators.required],
          city: ['', Validators.required],
          landmark: ['', Validators.required],
          state: ['', Validators.required],
          zip: ['', Validators.required],
          latitude: [null, Validators.required],  
          longitude: [null, Validators.required]
        })
      }),
      // Form controls matching the Tier-2 amenities
      amenities: this.fb.group({
        bed: [false], almirah: [false], studyTable: [false], fanLight: [false],
        roWater: [false], inverter: [false], cooling: [false], geyser: [false],
        wifi: [false], parking: [false], cctv: [false], washingMachine: [false],
        kitchen: [false]
      }),
      conditions: this.fb.group({
        coupleFriendly: [false], forBoys: [false], forGirls: [false], water24x7: [false],
        vegOnly: [false], familyFriendly: [false], studentsOnly: [false], workingProfessionals: [false]
      }),
      guidebook: this.fb.group({
        rules: this.fb.array([]),
        customRules: [''],
        nearby: this.fb.array([]) 
      }),
      final: this.fb.group({
        contactNo: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]], 
        name: ['', [Validators.required, Validators.maxLength(200)]],
        description: ['', [Validators.required, Validators.maxLength(1000)]],
        rentAmount: ['', Validators.required],
        images: [[]]
      })
    });

    this.addNearbyPlace();
    this.states = State.getStatesOfCountry('IN');
    
    this.detailsGroup.get('address.state')?.valueChanges.subscribe((stateName: string) => {
      const state = this.states.find(s => s.name === stateName);
      this.selectedStateIso = state ? state.isoCode : null;
      this.cities = this.selectedStateIso ? City.getCitiesOfState('IN', this.selectedStateIso) : [];
      if (!this.detailsGroup.get('address.city')?.value) {
        this.detailsGroup.get('address.city')?.reset();
      }
    });

    // Real-time OpenStreetMap Locality Search using forkJoin for UP and MH
    this.searchControl.valueChanges.pipe(
      debounceTime(500), 
      distinctUntilChanged(),
      filter((val): val is string => typeof val === 'string' && val.trim().length > 2), 
      switchMap(val => {
        const text = val as string;
        
        // Prepare queries for both target states
        const upQuery = `${text}, Uttar Pradesh`;
        const mhQuery = `${text}, Maharashtra`;
        
        // Build the Nominatim URLs
        const upUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(upQuery)}&addressdetails=1&countrycodes=in&limit=5`;
        const mhUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mhQuery)}&addressdetails=1&countrycodes=in&limit=5`;
        
        // Execute both calls in parallel using forkJoin
        return forkJoin({
          up: this.http.get<any[]>(upUrl).pipe(catchError(() => of([]))),
          mh: this.http.get<any[]>(mhUrl).pipe(catchError(() => of([])))
        }).pipe(
          map(({ up, mh }) => {
            // Combine results from both states
            const combined = [...up, ...mh];
            
            // Sort by OpenStreetMap's relevance 'importance' score
            return combined
              .sort((a, b) => (b.importance || 0) - (a.importance || 0))
              .slice(0, 6); // Keep the top 6 most relevant results overall
          })
        );
      })
    ).subscribe(results => {
      this.searchResults = results || [];
      this.cd.detectChanges();
    });

    if (isPlatformBrowser(this.platformId)) {
      this.fixLeafletIcons();
    }
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      if (this.currentStep === 1) {
        this.loadMapSafely();
      }
    }
  }

  loadMapSafely(): void {
    if (isPlatformBrowser(this.platformId)) {
      const checkExist = setInterval(() => {
        const mapElement = document.getElementById('propertyMap');
        if (mapElement) {
          clearInterval(checkExist); 
          this.initMap();            
        }
      }, 100);
    }
  }

  get detailsGroup(): FormGroup { return this.listingForm.get('details') as FormGroup; }
  get amenitiesGroup(): FormGroup { return this.listingForm.get('amenities') as FormGroup; }
  get conditionsGroup(): FormGroup { return this.listingForm.get('conditions') as FormGroup; }
  get guidebookGroup(): FormGroup { return this.listingForm.get('guidebook') as FormGroup; }
  get finalGroup(): FormGroup { return this.listingForm.get('final') as FormGroup; }
  get nearbyPlaces(): FormArray { return this.guidebookGroup.get('nearby') as FormArray; }
  get rulesArray(): FormArray { return this.guidebookGroup.get('rules') as FormArray; }

  toggleRule(ruleValue: string): void {
    const index = this.rulesArray.controls.findIndex(x => x.value === ruleValue);
    if (index === -1) {
      this.rulesArray.push(this.fb.control(ruleValue));
    } else {
      this.rulesArray.removeAt(index);
    }
  }

  isRuleSelected(ruleValue: string): boolean {
    return this.rulesArray.controls.some(x => x.value === ruleValue);
  }

  addNearbyPlace(): void {
    const placeGroup = this.fb.group({
      name: ['', Validators.required],
      distance: ['', Validators.required], 
      type: ['place'] 
    });
    this.nearbyPlaces.push(placeGroup);
  }

  removeNearbyPlace(index: number): void {
    this.nearbyPlaces.removeAt(index);
  }

  updateCounter(controlName: string, change: number): void {
    const control = this.detailsGroup.get(controlName);
    if (control) {
      const newValue = (control.value || 0) + change;
      if (newValue >= 0) control.setValue(newValue);
    }
  }

  selectLocation(result: any): void {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    if (this.map) {
      this.map.setView([lat, lon], 16);
    }

    if (this.marker) {
      this.marker.setLatLng([lat, lon]);
    } else if (this.map) {
      import('leaflet').then(leaflet => {
        this.marker = leaflet.marker([lat, lon]).addTo(this.map!);
      });
    }

    const addr = result.address || {};
    const city = addr.city || addr.town || addr.village || addr.county || '';
    const state = addr.state || '';
    const zip = addr.postcode || '';
    
    // Expanded landmark fallback
    const landmark = addr.neighbourhood || addr.suburb || addr.quarter || addr.borough || addr.city_district || addr.county || '';
    
    // Fallback for street using display name if no exact road is found
    const street = addr.road || addr.suburb || result.name || result.display_name.split(',')[0] || '';

    this.detailsGroup.get('address.state')?.patchValue(state);
    this.detailsGroup.get('address')?.patchValue({
      latitude: lat,
      longitude: lon,
      city: city,
      zip: zip,
      street: street, 
      landmark: landmark
    });

    this.searchResults = [];
    this.searchControl.setValue(result.display_name, { emitEvent: false });
  }

  private readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  async onFileSelected(event: any): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    this.isUploading = true;

    try {
      const newFiles: File[] = [];
      const newOriginals: File[] = [];
      const newPreviews: string[] = [];

      for (const file of Array.from(files)) {
        // 1. Rename the original file to include '-org'
        const dotIndex = file.name.lastIndexOf('.');
        const baseName = dotIndex !== -1 ? file.name.substring(0, dotIndex) : file.name;
        const extension = dotIndex !== -1 ? file.name.substring(dotIndex) : '';
        const orgFileName = `${baseName}-org${extension}`;
        
        const originalFileToSave = new File([file], orgFileName, { type: file.type });

        // 2. Create the watermarked version (keeps the normal name)
        const watermarkedFile = await this.watermarkImage(file);

        // 3. Save both to their respective arrays
        newOriginals.push(originalFileToSave);
        newFiles.push(watermarkedFile);
        
        const preview = await this.readFileAsDataURL(watermarkedFile);
        newPreviews.push(preview);
      }

      this.originalFiles = [...this.originalFiles, ...newOriginals];
      this.selectedFiles = [...this.selectedFiles, ...newFiles];
      this.imagePreviews = [...this.imagePreviews, ...newPreviews];
      this.finalGroup.patchValue({ images: this.selectedFiles });
      this.cd.detectChanges();

    } catch (err) {
      console.error('Error processing images:', err);
      this.toastr.error('Failed to process images.');
    } finally {
      this.isUploading = false;
      input.value = ''; 
      this.cd.detectChanges(); 
    }
  }

  removeImage(index: number): void {
    this.imagePreviews.splice(index, 1);
    this.selectedFiles.splice(index, 1);
    this.originalFiles.splice(index, 1); // Remove the matching original file
    this.finalGroup.patchValue({ images: this.selectedFiles });
  }

  nextStep(): void {
    let groupName = '';
    if (this.currentStep === 1) groupName = 'details';
    else if (this.currentStep === 2) groupName = 'amenities';
    else if (this.currentStep === 3) groupName = 'guidebook';
    else groupName = 'final';

    const group = this.listingForm.get(groupName) as FormGroup;

    if (group && group.valid) {
      if (this.currentStep < this.totalSteps) {
        this.currentStep++;
        if (isPlatformBrowser(this.platformId)) window.scrollTo(0, 0);
      }
    } else {
      group?.markAllAsTouched();
      console.warn(`Validation failed on Step ${this.currentStep}. Missing fields:`);
      this.findInvalidControls(group);
      this.toastr.warning('Please complete the highlighted fields.', 'Step Incomplete');
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      if (isPlatformBrowser(this.platformId)) window.scrollTo(0, 0);
      
      if (this.currentStep === 1) {
        this.loadMapSafely();
      }
    }
  }

 onSubmit(): void {
    if (this.listingForm.valid) {
      if (this.isSubmitting) return;

      const rawData = this.listingForm.value;

      // 1. Format the description (converting newlines to pipe separators)
      const payload = {
        ...rawData,
        final: {
          ...rawData.final,
          description: rawData.final.description
            ? rawData.final.description
                .split(/\r?\n/) 
                .map((line: string) => line.trim()) 
                .filter((line: string) => line.length > 0) 
                .join(' | ') 
            : ''
        }
      };

      // 2. Combine watermarked and original files for Hostinger
      const watermarked: File[] = payload.final.images || [];
      const filesToSend: File[] = [...watermarked, ...this.originalFiles];

      // We check the watermarked array length to ensure they have at least 2 valid display photos
      if (watermarked.length < 2) {
        this.toastr.error('Please upload at least two images.', 'Error');
        return;
      }

      // Reassign the combined array to the payload
      payload.final.images = filesToSend;
      
      this.isSubmitting = true;

     // 3. Send to Service
      this.propertyService.saveListing(payload).subscribe({
        next: (response: any) => {
          this.toastr.success('Listing uploaded successfully!', 'Success');
          this.isSubmitting = false;
          
          // Assuming your backend returns the new object in response.data or directly in response
          const newListingId = response?.data?.listingId || response?.listingId;

          if (newListingId) {
            // Navigate directly to the new property details page
            this.router.navigate(['/room', newListingId]);
          } else {
            // Fallback just in case the ID isn't returned
            this.router.navigate(['/explore-listing']);
          }
        },
        error: (error) => {
          console.error('Error:', error);
          this.toastr.error('Failed to save listing.', 'Error');
          this.isSubmitting = false; 
        }
      });
    } else {
      // Handle Validation Failure
      this.listingForm.markAllAsTouched();
      console.warn('Final Form Submission Failed. Missing fields:');
      this.findInvalidControls(this.listingForm);
      this.toastr.error('Please fill in all highlighted required fields.');
    }
  }

 private async watermarkImage(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (readerEvent: any) => {
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
          
          // 1. Draw the original image
          ctx.drawImage(img, 0, 0);

          // 2. Set up the transparent, large font
          // Increased from 0.05 to 0.12 for a larger, bolder presence
          const fontSize = Math.floor(canvas.width * 0.12); 
          ctx.font = `bold ${fontSize}px Arial`;
          
          // Center alignment
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Soft shadow to ensure it's readable on both dark and light walls
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 3;
          ctx.shadowOffsetY = 3;
          
          // 3. Set transparency (0.25 opacity makes it clearly visible but see-through)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'; 

          // 4. Move the canvas origin to the dead center of the image
          ctx.translate(canvas.width / 2, canvas.height / 2);
          
          // 5. Rotate the canvas diagonally (-45 degrees)
          ctx.rotate(-Math.PI / 4); 

          // 6. Draw the text at the new center (0, 0)
          ctx.fillText(this.WATERMARK_TEXT, 0, 0);

          // Convert back to a File object
          canvas.toBlob((blob) => {
            if (blob) {
              const newFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(newFile);
            } else {
              reject(new Error('Canvas to Blob conversion failed'));
            }
          }, file.type, 0.9); 
        };

        img.onerror = (err) => reject(err);
        img.src = readerEvent.target.result;
      };

      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }
  
  private async fixLeafletIcons() {
    const leaflet = await import('leaflet');
    const iconDefault = leaflet.icon({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41]
    });
    leaflet.Marker.prototype.options.icon = iconDefault;
  }

  private async initMap(): Promise<void> {
    const leaflet = await import('leaflet');
    const defaultLat = 20.5937;
    const defaultLng = 78.9629;

    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }

    this.map = leaflet.map('propertyMap').setView([defaultLat, defaultLng], 5);

    leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    this.map.on('click', (e: any) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      this.setMarkerAndAddress(lat, lng);
    });

    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 500);
  }

  detectLocation(): void {
    if (isPlatformBrowser(this.platformId) && navigator.geolocation) {
      this.toastr.info('Detecting location...', 'Please wait');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          if (this.map) {
            this.map.setView([lat, lng], 16);
          }
          this.setMarkerAndAddress(lat, lng);
          this.toastr.success('Location detected!');
        },
        (error) => {
          this.toastr.error('Could not detect location. Please pick on the map.');
        }
      );
    } else if (isPlatformBrowser(this.platformId)) {
      this.toastr.error('Geolocation is not supported by your browser.');
    }
  }

  private async setMarkerAndAddress(lat: number, lng: number): Promise<void> {
    const leaflet = await import('leaflet');

    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else if (this.map) {
      this.marker = leaflet.marker([lat, lng]).addTo(this.map);
    }

    this.detailsGroup.get('address')?.patchValue({
      latitude: lat,
      longitude: lng
    });

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    
    this.http.get<any>(url).subscribe(res => {
      if (res && res.address) {
        const addr = res.address;
        const city = addr.city || addr.town || addr.village || addr.county || '';
        const state = addr.state || '';
        const zip = addr.postcode || '';
        const street = addr.road || addr.suburb || '';
        const landmark = addr.county || addr.neighbourhood || ''; 
        this.detailsGroup.get('address.state')?.patchValue(state);
        this.detailsGroup.get('address')?.patchValue({
          city: city,
          zip: zip,
          street: street,
          landmark: landmark
        });
      }
    });
  }

  private findInvalidControls(formGroup: FormGroup | FormArray) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      if (control instanceof FormGroup || control instanceof FormArray) {
        this.findInvalidControls(control);
      } else if (control?.invalid) {
        console.error(`🔴 Invalid field found: '${key}'`, control.errors);
      }
    });
  }
}