import { Injectable, Inject, Renderer2, RendererFactory2 } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { PageSeoInput, SEO_CONFIG } from '../config/seo.config';

const JSON_LD_ID = 'roomzo-json-ld';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private renderer: Renderer2;

  constructor(
    private title: Title,
    private meta: Meta,
    @Inject(DOCUMENT) private document: Document,
    rendererFactory: RendererFactory2
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  /** Apply full page SEO: title, meta, canonical, OG, Twitter, robots, hreflang. */
  applyPageSeo(input: PageSeoInput): void {
    const canonical = this.buildCanonicalUrl(input.path);
    const ogImage = input.ogImage ?? SEO_CONFIG.defaultOgImage;
    const keywords = input.keywords?.join(', ') ?? SEO_CONFIG.brandKeywords.join(', ');

    this.title.setTitle(input.title);

    this.setOrUpdateMeta('name', 'description', input.description);
    this.setOrUpdateMeta('name', 'keywords', keywords);
    this.setOrUpdateMeta('property', 'og:site_name', SEO_CONFIG.siteName);
    this.setOrUpdateMeta('property', 'og:title', input.title);
    this.setOrUpdateMeta('property', 'og:description', input.description);
    this.setOrUpdateMeta('property', 'og:type', input.ogType ?? 'website');
    this.setOrUpdateMeta('property', 'og:url', canonical);
    this.setOrUpdateMeta('property', 'og:image', ogImage);
    this.setOrUpdateMeta('property', 'og:locale', SEO_CONFIG.defaultLocale.replace('-', '_'));

    this.setOrUpdateMeta('name', 'twitter:card', 'summary_large_image');
    this.setOrUpdateMeta('name', 'twitter:site', SEO_CONFIG.twitterHandle);
    this.setOrUpdateMeta('name', 'twitter:title', input.title);
    this.setOrUpdateMeta('name', 'twitter:description', input.description);
    this.setOrUpdateMeta('name', 'twitter:image', ogImage);

    this.setCanonical(canonical);
    this.setHreflang(input.path);

    if (input.noindex) {
      this.setOrUpdateMeta('name', 'robots', 'noindex, nofollow');
    } else {
      this.removeMeta('name', 'robots');
    }

    if (input.jsonLd) {
      this.setJsonLd(input.jsonLd);
    }
  }

  setJsonLd(schema: Record<string, unknown> | Record<string, unknown>[]): void {
    this.removeJsonLd();
    const payload = Array.isArray(schema) ? schema : [schema];
    const script = this.renderer.createElement('script');
    script.type = 'application/ld+json';
    script.id = JSON_LD_ID;
    script.text = JSON.stringify(payload.length === 1 ? payload[0] : payload);
    this.renderer.appendChild(this.document.head, script);
  }

  removeJsonLd(): void {
    const existing = this.document.getElementById(JSON_LD_ID);
    if (existing) {
      this.renderer.removeChild(this.document.head, existing);
    }
  }

  buildCanonicalUrl(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${SEO_CONFIG.siteUrl}${normalized}`;
  }

  buildRoomPath(id: string | number): string {
    return `/room/${id}`;
  }

  /** Product + Offer JSON-LD for rental listings (rich snippets). */
  buildListingJsonLd(property: {
    id: string | number;
    propertyType?: string;
    propertyName?: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    zipCode?: string;
    rentAmount?: number;
    description?: string;
    isRented?: number | boolean;
    photos?: { photoUrl: string }[];
    latitude?: number;
    longitude?: number;
    bedrooms?: number;
    bathrooms?: number;
  }): Record<string, unknown> {
    const name =
      property.propertyName ||
      `${property.propertyType ?? 'Room'} in ${property.city ?? 'India'}`;
    const image =
      property.photos?.[0]?.photoUrl ?? SEO_CONFIG.defaultOgImage;
    const available =
      property.isRented === 1 || property.isRented === true
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock';

    const address: Record<string, string> = {};
    if (property.street) address['streetAddress'] = property.street;
    if (property.city) address['addressLocality'] = property.city;
    if (property.state) address['addressRegion'] = property.state;
    const zip = property.zip ?? property.zipCode;
    if (zip) address['postalCode'] = String(zip);
    address['addressCountry'] = 'IN';

    const product: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name,
      description:
        property.description?.replace(/\|/g, ' ').slice(0, 300) ??
        `${name} — broker-free rental on Roomzo`,
      image: property.photos?.map((p) => p.photoUrl) ?? [image],
      brand: { '@type': 'Brand', name: SEO_CONFIG.siteName },
      url: this.buildCanonicalUrl(this.buildRoomPath(property.id)),
      offers: {
        '@type': 'Offer',
        price: property.rentAmount ?? 0,
        priceCurrency: 'INR',
        availability: available,
        url: this.buildCanonicalUrl(this.buildRoomPath(property.id)),
        seller: {
          '@type': 'Organization',
          name: SEO_CONFIG.siteName,
        },
        priceValidUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
    };

    if (Object.keys(address).length > 1) {
      product['address'] = { '@type': 'PostalAddress', ...address };
    }

    if (property.latitude && property.longitude) {
      product['geo'] = {
        '@type': 'GeoCoordinates',
        latitude: property.latitude,
        longitude: property.longitude,
      };
    }

    if (property.bedrooms) {
      product['numberOfRooms'] = property.bedrooms;
    }

    return product;
  }

  buildBreadcrumbJsonLd(
    items: { label: string; path?: string }[]
  ): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.label,
        ...(item.path
          ? { item: this.buildCanonicalUrl(item.path) }
          : {}),
      })),
    };
  }

  buildCityCollectionJsonLd(city: {
    name: string;
    state: string;
    slug: string;
  }): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `Rooms for rent in ${city.name}`,
      description: getCitySeoDescriptionText(city.name, city.state),
      url: this.buildCanonicalUrl(`/city/${city.slug}`),
      isPartOf: {
        '@type': 'WebSite',
        name: SEO_CONFIG.siteName,
        url: SEO_CONFIG.siteUrl,
      },
      about: {
        '@type': 'Place',
        name: city.name,
        address: {
          '@type': 'PostalAddress',
          addressLocality: city.name,
          addressRegion: city.state,
          addressCountry: 'IN',
        },
      },
    };
  }

  buildItemListJsonLd(
    listings: { id: string | number; propertyType?: string; city?: string; rentAmount?: number }[],
    listName: string
  ): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: listName,
      numberOfItems: listings.length,
      itemListElement: listings.slice(0, 20).map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: this.buildCanonicalUrl(this.buildRoomPath(item.id)),
        name: `${item.propertyType ?? 'Room'} in ${item.city ?? 'India'} — ₹${item.rentAmount ?? 0}/mo`,
      })),
    };
  }

  buildFaqJsonLd(faqs: { question: string; answer: string }[]): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    };
  }

 private setCanonical(url: string): void {
    let link = this.document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = this.renderer.createElement('link') as HTMLLinkElement;
      link!.setAttribute('rel', 'canonical');
      this.renderer.appendChild(this.document.head, link);
    }
    link!.setAttribute('href', url);
  }

  private setHreflang(path: string): void {
    this.document
      .querySelectorAll('link[rel="alternate"][data-roomzo-hreflang]')
      .forEach((el) => el.remove());

    const normalized = path.startsWith('/') ? path : `/${path}`;
    const url = `${SEO_CONFIG.siteUrl}${normalized}`;

    for (const locale of SEO_CONFIG.locales) {
      const link = this.renderer.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', locale);
      link.setAttribute('href', url);
      link.setAttribute('data-roomzo-hreflang', 'true');
      this.renderer.appendChild(this.document.head, link);
    }

    const xDefault = this.renderer.createElement('link');
    xDefault.setAttribute('rel', 'alternate');
    xDefault.setAttribute('hreflang', 'x-default');
    xDefault.setAttribute('href', url);
    xDefault.setAttribute('data-roomzo-hreflang', 'true');
    this.renderer.appendChild(this.document.head, xDefault);
  }

  private setOrUpdateMeta(attr: 'name' | 'property', key: string, content: string): void {
    const selector = attr === 'name' ? `name="${key}"` : `property="${key}"`;
    if (this.meta.getTag(selector)) {
      this.meta.updateTag({ [attr]: key, content });
    } else {
      this.meta.addTag({ [attr]: key, content });
    }
  }

  private removeMeta(attr: 'name' | 'property', key: string): void {
    const selector = attr === 'name' ? `name="${key}"` : `property="${key}"`;
    const tag = this.meta.getTag(selector);
    if (tag) {
      this.meta.removeTagElement(tag);
    }
  }
}

function getCitySeoDescriptionText(name: string, state: string): string {
  return `Verified broker-free rooms, PGs, and flats for rent in ${name}, ${state} on Roomzo.`;
}
