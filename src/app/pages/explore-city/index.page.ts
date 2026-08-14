import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID, signal, OnDestroy, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { slugifyCity } from '../../config/cities.config';

@Component({
  selector: 'app-explore-city-redirect',
  standalone: true,
  imports: [CommonModule],
  template: `<p class="redirect-msg">Redirecting to city page…</p>`,
  styles: [`.redirect-msg { padding: 6rem 1rem; text-align: center; color: #64748b; }`],
})
export default class ExploreCityRedirectComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const city = params['city'];
      if (city) {
        this.router.navigate(['/city', slugifyCity(city)], { replaceUrl: true });
      } else {
        this.router.navigate(['/explore-listing'], { replaceUrl: true });
      }
    });
  }
}