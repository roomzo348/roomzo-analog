import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from "@angular/material/autocomplete";
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select'; 
import { HttpClient } from '@angular/common/http';
import { of, forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, filter, map } from 'rxjs/operators';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule, 
    MatAutocompleteModule, 
    MatIconModule, 
    MatSelectModule
  ],
  templateUrl: './search-bar.html',
  styleUrls: ['./search-bar.css']
})
export class SearchBarComponent implements OnInit, OnDestroy {
  searchControl = new FormControl<string | any>('');
  propertyTypeControl = new FormControl<string>('Any');
  budgetControl = new FormControl<number>(50000);

  filteredCities: any[] = [];

  // --- Dynamic Placeholder Properties ---
  placeholders: string[] = [
    'Search "Civil lines, Prayagraj"',
    'Search "Mumfordganj, Prayagraj"',
    'Search  "Teliyarganj, Prayagraj"',
    'Search  "Viman Nagar, Pune"', // Added Pune context
    'Search  "Katra, Prayagraj"',
    'Search  "Lanka, Varanasi"',  // Added Varanasi context
    'Search  "Kydganj, Prayagraj"',
    'Search  "Naini, Prayagraj"',
  ];
  currentPlaceholder: string = '';
  private charIndex: number = 0;
  private placeholderIndex: number = 0;
  private typingTimeout: any;
  private isDestroyed = false;

  constructor(
    private router: Router, 
    private http: HttpClient,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.typeEffect();
    this.setupAutocomplete();
  }

  private setupAutocomplete() {
    this.searchControl.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      filter((val): val is string => typeof val === 'string' && val.length > 2),
      switchMap(val => {
        // 1. Prepare queries for both target states
        const upQuery = `${val}, Uttar Pradesh`;
        const mhQuery = `${val}, Maharashtra`;

        // 2. Build the Nominatim URLs
        const upUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(upQuery)}&addressdetails=1&countrycodes=in&limit=7`;
        const mhUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mhQuery)}&addressdetails=1&countrycodes=in&limit=7`;
        
        // 3. Execute both calls in parallel using forkJoin
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
      this.filteredCities = results || [];
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
  }

  // --- Optimised Typewriter Logic with ChangeDetectorRef ---
  private typeEffect() {
    if (this.isDestroyed) return;

    const currentWord = this.placeholders[this.placeholderIndex];
    
    if (this.charIndex < currentWord.length) {
      this.ngZone.run(() => {
        this.currentPlaceholder += currentWord.charAt(this.charIndex);
        this.cdr.markForCheck();   // Immediate UI update
      });
      this.charIndex++;
      this.typingTimeout = setTimeout(() => this.typeEffect(), 40);
    } else {
      this.typingTimeout = setTimeout(() => this.eraseEffect(), 1800);
    }
  }

  private eraseEffect() {
    if (this.isDestroyed) return;

    if (this.charIndex > 0) {
      this.ngZone.run(() => {
        this.currentPlaceholder = this.currentPlaceholder.substring(0, this.charIndex - 1);
        this.cdr.markForCheck();   // Immediate UI update
      });
      this.charIndex--;
      this.typingTimeout = setTimeout(() => this.eraseEffect(), 25);
    } else {
      this.placeholderIndex = (this.placeholderIndex + 1) % this.placeholders.length;
      this.typingTimeout = setTimeout(() => this.typeEffect(), 200);
    }
  }

  displayCity = (loc: any): string => {
    if (!loc) return '';
    if (typeof loc === 'string') return loc;
    
    const a = loc.address || {};
    const name = a.neighbourhood || a.suburb || a.village || a.town || loc.name || '';
    const city = a.city || a.state_district || '';
    const state = a.state || '';

    return [name, city, state]
      .filter((v, i, arr) => v && arr.indexOf(v) === i)
      .join(', ');
  }

  onCitySelected(event: any) {
    const loc = event.option.value;
    this.navigateToExplore(loc);
  }

  search(event?: Event) {
    if (event) event.preventDefault();
    
    const val = this.searchControl.value;

    if (val && typeof val === 'object') {
       this.navigateToExplore(val);
    } else if (typeof val === 'string' && val.trim()) {
       this.router.navigate(['/explore-listing'], { 
         queryParams: { 
           city: val,
           propertyType: this.propertyTypeControl.value,
           maxPrice: this.budgetControl.value
         } 
       });
    } else {
       this.router.navigate(['/explore-listing'], { 
        queryParams: { 
          propertyType: this.propertyTypeControl.value,
          maxPrice: this.budgetControl.value
        } 
      });
    }
  }

  private navigateToExplore(locData: any) {
    console.log('Selected Location Data:', locData);
    this.router.navigate(['/explore-listing'], { 
      queryParams: { 
        street: locData.address?.suburb,
        city: locData.address?.city || locData.address?.town || locData.name, 
        state: locData.address?.state,
        lat: locData.lat,
        lng: locData.lon,
        propertyType: this.propertyTypeControl.value,
        maxPrice: this.budgetControl.value
      } 
    });
  }
}