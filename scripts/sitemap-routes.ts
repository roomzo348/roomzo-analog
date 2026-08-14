import { SEO_CONFIG } from '../src/app/config/seo.config';
import { getActiveCities, ROOMZO_CITIES } from '../src/app/config/cities.config';
import { ROOMZO_CATEGORIES } from '../src/app/config/categories.config';
import { BLOG_POSTS } from '../src/app/services/blog-contents';

const API_URL = 'https://traditional-jobi-roomzo-free-5e097403.koyeb.app';

interface SitemapRoute {
  route: string;
  sitemap?: {
    changefreq?: string;
    priority?: string;
    lastmod?: string;
  };
}

const STATIC_ROUTES: SitemapRoute[] = [
  { route: '/', sitemap: { changefreq: 'daily', priority: '1.0' } },
  { route: '/about', sitemap: { changefreq: 'monthly', priority: '0.7' } },
  { route: '/faq', sitemap: { changefreq: 'monthly', priority: '0.8' } },
  { route: '/explore-listing', sitemap: { changefreq: 'daily', priority: '0.9' } },
  { route: '/flatmates', sitemap: { changefreq: 'weekly', priority: '0.7' } },
  { route: '/blog', sitemap: { changefreq: 'weekly', priority: '0.7' } },
  { route: '/terms', sitemap: { changefreq: 'yearly', priority: '0.3' } },
  { route: '/privacy-policy', sitemap: { changefreq: 'yearly', priority: '0.3' } },
];

export async function buildPrerenderRoutes(): Promise<SitemapRoute[]> {
  const today = new Date().toISOString().split('T')[0];
  const routes: SitemapRoute[] = [...STATIC_ROUTES];

  for (const city of ROOMZO_CITIES.filter((c) => c.active)) {
    routes.push({
      route: `/city/${city.slug}`,
      sitemap: { changefreq: 'daily', priority: '0.9', lastmod: today },
    });
  }

  for (const category of ROOMZO_CATEGORIES) {
    routes.push({
      route: `/category/${category.slug}`,
      sitemap: { changefreq: 'weekly', priority: '0.8', lastmod: today },
    });
  }

  for (const post of BLOG_POSTS) {
    routes.push({
      route: `/blog/${post.slug}`,
      sitemap: { changefreq: 'monthly', priority: '0.6', lastmod: today },
    });
  }

  // Listing pages (/room/:id) are NOT prerendered here — that was causing 15–20 min builds
  // when hundreds of listings were SSR-rendered one-by-one. SEO is covered by:
  // - runtime SSR when users/Google visit /room/:id
  // - dynamic sitemap at src/server/routes/sitemap.xml.ts
  //
  // Set PRERENDER_LISTINGS=1 for a full SEO static export (slow CI/deploy only).
  if (process.env.PRERENDER_LISTINGS === '1') {
    try {
      const listingIds = await fetchListingIds();
      for (const id of listingIds) {
        routes.push({
          route: `/room/${id}`,
          sitemap: { changefreq: 'weekly', priority: '0.8', lastmod: today },
        });
      }
    } catch (err) {
      console.warn('[sitemap] Could not fetch listing IDs:', err);
    }
  }

  return routes;
}

async function fetchListingIds(): Promise<string[]> {
  const ids: string[] = [];
  let page = 0;
  const size = 50;
  let totalPages = 1;

  while (page < totalPages && page < 20) {
    const res = await fetch(`${API_URL}/listings/all?page=${page}&size=${size}&isRented=0`);
    if (!res.ok) break;
    const data = await res.json();
    totalPages = data.totalPages ?? 1;
    for (const listing of data.listings ?? []) {
      if (listing.id) ids.push(String(listing.id));
    }
    page++;
  }

  return ids;
}

export { SEO_CONFIG, getActiveCities };
