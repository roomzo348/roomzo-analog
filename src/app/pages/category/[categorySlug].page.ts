import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RouteMeta } from '@analogjs/router';
import { SeoService } from '../../services/seo.service';
import { getCategoryBySlug, ROOMZO_CATEGORIES } from '../../config/categories.config';
import { RelatedSearchesComponent } from '../../components/related-searches/related-searches';
import { SeoBreadcrumbComponent } from '../../components/seo-breadcrumb/seo-breadcrumb';
import { MatIconModule } from '@angular/material/icon';
import { ContentGuideComponent } from '../../components/content-guide/content-guide';
import { CategoryGuide, getCategoryGuide } from '../../content/category-guides';
import { GuideSection } from '../../content/city-guides';

export const routeMeta: RouteMeta = {
  title: 'Browse Rental Categories | Roomzo',
};

@Component({
  selector: 'app-category-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, RelatedSearchesComponent, SeoBreadcrumbComponent, MatIconModule, ContentGuideComponent],
  templateUrl: './category-landing.html',
  styleUrls: ['./category-landing.css'],
})
export default class CategoryLandingPage implements OnInit, OnDestroy {
  categorySlug = '';
  category = getCategoryBySlug('rooms-for-rent')!;
  allCategories = [...ROOMZO_CATEGORIES];
  categoryGuide: CategoryGuide | null = null;
  guideSections: GuideSection[] = [];

  breadcrumbItems = [
    { label: 'Home', path: '/' },
    { label: 'Categories', path: '/explore-listing' },
    { label: '' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private seo: SeoService
  ) {}

  ngOnInit(): void {
    const hasFlatmates = this.allCategories.some(c => c.slug.includes('flatmate'));
    if (!hasFlatmates) {
      this.allCategories.push({
        slug: 'flatmates',
        label: 'Find Flatmates',
        seoTitle: 'Find Flatmates',
        seoDescription: 'Find verified flatmates and room partners.',
        keywords: []
      } as any);
    }

    this.route.paramMap.subscribe((params) => {
      this.categorySlug = params.get('categorySlug') ?? '';
      
      let found = getCategoryBySlug(this.categorySlug);
      if (this.categorySlug === 'flatmates') {
        found = this.allCategories.find(c => c.slug === 'flatmates');
      }

      if (!found) {
        this.router.navigate(['/explore-listing'], { replaceUrl: true });
        return;
      }
      
      this.category = found;
      this.breadcrumbItems[2] = { label: found.label };
      this.categoryGuide = getCategoryGuide(found.slug);
      this.guideSections = this.categoryGuide?.sections ?? [];

      this.seo.applyPageSeo({
        title: found.seoTitle,
        description: found.seoDescription,
        path: `/category/${found.slug}`,
        keywords: found.keywords,
        jsonLd: [
          this.seo.buildBreadcrumbJsonLd(this.breadcrumbItems),
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: found.label,
            description: found.seoDescription,
            url: this.seo.buildCanonicalUrl(`/category/${found.slug}`),
          },
        ],
      });
    });
  }

  ngOnDestroy(): void {
    this.seo.removeJsonLd();
  }

  // --- 🚀 THE FIX: Universal Routing Logic ---
  handleCategoryRoute(cat: any, event?: Event): void {
    if (event) {
      event.preventDefault();
    }

    const slug = cat.slug.toLowerCase();

    // 1. Flatmates Route
    if (slug.includes('flatmate')) {
      this.router.navigate(['/flatmates']);
      return;
    }

    const queryParams: Record<string, string> = {};

    // 2. Map the Property Type
    if (slug.includes('pg') || slug.includes('hostel') || slug.includes('co-living')) {
      queryParams['propertyType'] = 'PG';
    } else if (slug.includes('flat') || slug.includes('apartment') || slug.includes('bhk')) {
      queryParams['propertyType'] = 'Flat';
    } else if (slug.includes('room') || slug.includes('student')) {
      queryParams['propertyType'] = 'Room';
    }

    // 3. Map to City Route OR Explore Listing
    const knownCities = ['prayagraj', 'varanasi', 'lucknow', 'pune'];
    const targetCity = knownCities.find(city => slug.includes(city));

    if (targetCity) {
      // Goes to /city/varanasi?propertyType=Flat
      this.router.navigate(['/city', targetCity], { queryParams });
    } else {
      // Goes to /explore-listing?propertyType=Flat
      this.router.navigate(['/explore-listing'], { queryParams });
    }
  }

  // --- Direct City Click Handler ---
  goToCity(cityName: string): void {
    this.router.navigate(['/city', cityName.toLowerCase()]);
  }

  // --- UI Helpers ---
  getIconForCategory(slug: string): string {
    const s = slug.toLowerCase();
    if (s.includes('room')) return 'home';
    if (s.includes('flat')) return 'apartment';
    if (s.includes('pg') || s.includes('hostel')) return 'bed';
    if (s.includes('student')) return 'school';
    if (s.includes('broker') || s.includes('free')) return 'percent';
    if (s.includes('99acres')) return 'domain';
    if (s.includes('flatmate')) return 'people';
    return 'language'; 
  }

  getSubtitleForCategory(slug: string): string {
    const s = slug.toLowerCase();
    if (s.includes('room')) return 'Find private & shared rooms';
    if (s.includes('flat')) return '1BHK, 2BHK, 3BHK & more';
    if (s.includes('pg')) return 'Boys PG, Girls PG & Co-living';
    if (s.includes('student')) return 'Near colleges & coaching hubs';
    if (s.includes('broker')) return 'No brokerage. Direct owner contact.';
    if (s.includes('flatmate')) return 'Find like-minded roommates';
    return 'Verified listings. No hidden charges.';
  }
}