import { defineEventHandler, setHeader } from 'h3';
import { ROOMZO_CITIES } from '../../app/config/cities.config';
import { ROOMZO_CATEGORIES } from '../../app/config/categories.config';
import { BLOG_POSTS } from '../../app/services/blog-contents';
import { SEO_CONFIG } from '../../app/config/seo.config';
import { sqlQuery } from '../db/mysql';

const HOST = SEO_CONFIG.siteUrl;

function urlEntry(
  loc: string,
  opts?: { changefreq?: string; priority?: string; lastmod?: string }
): string {
  return `  <url>
    <loc>${loc}</loc>${opts?.lastmod ? `\n    <lastmod>${opts.lastmod}</lastmod>` : ''}${opts?.changefreq ? `\n    <changefreq>${opts.changefreq}</changefreq>` : ''}${opts?.priority ? `\n    <priority>${opts.priority}</priority>` : ''}
  </url>`;
}

async function fetchListingIds(): Promise<string[]> {
  try {
    const rows = await sqlQuery<{ id: number }>(
      `SELECT id FROM property_listings WHERE COALESCE(is_rented, 0) = 0 ORDER BY created_on DESC LIMIT 5000`
    );
    return rows.map((r) => String(r.id));
  } catch {
    return [];
  }
}

export default defineEventHandler(async (event) => {
  const today = new Date().toISOString().split('T')[0];
  const staticPaths = [
    '/',
    '/about',
    '/faq',
    '/explore-listing',
    '/flatmates',
    '/blog',
    '/terms',
    '/privacy-policy',
  ];

  const entries: string[] = staticPaths.map((path) =>
    urlEntry(`${HOST}${path}`, {
      lastmod: today,
      changefreq: path === '/' ? 'daily' : 'weekly',
      priority: path === '/' ? '1.0' : '0.7',
    })
  );

  for (const city of ROOMZO_CITIES.filter((c) => c.active)) {
    entries.push(
      urlEntry(`${HOST}/city/${city.slug}`, {
        lastmod: today,
        changefreq: 'daily',
        priority: '0.9',
      })
    );
  }

  for (const category of ROOMZO_CATEGORIES) {
    entries.push(
      urlEntry(`${HOST}/category/${category.slug}`, {
        lastmod: today,
        changefreq: 'weekly',
        priority: '0.8',
      })
    );
  }

  for (const post of BLOG_POSTS) {
    entries.push(
      urlEntry(`${HOST}/blog/${post.slug}`, {
        lastmod: today,
        changefreq: 'monthly',
        priority: '0.6',
      })
    );
  }

  const listingIds = await fetchListingIds();
  for (const id of listingIds) {
    entries.push(
      urlEntry(`${HOST}/room/${id}`, {
        lastmod: today,
        changefreq: 'weekly',
        priority: '0.8',
      })
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;

  setHeader(event, 'content-type', 'text/xml; charset=utf-8');
  setHeader(event, 'cache-control', 'public, max-age=3600');
  return xml;
});
