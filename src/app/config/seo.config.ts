/** Central SEO constants — single source of truth for meta & schema. */
export const SEO_CONFIG = {
  siteName: 'Roomzo',
  siteUrl: 'https://www.roomzo.in',
  defaultLocale: 'en-IN',
  locales: ['en-IN'] as const,
  defaultOgImage: 'https://www.roomzo.in/assets/og-roomzo-share.jpg',
  twitterHandle: '@roomzoofficial',
  brandKeywords: [
    'room for rent',
    'student housing',
    'brokerless property',
    'pg for rent',
    'flat for rent',
    'no broker rental',
    'verified listings',
    'direct owner contact',
  ],
  searchActionPath: '/explore-listing',
} as const;

export interface PageSeoInput {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  ogImage?: string;
  ogType?: 'website' | 'article' | 'product';
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}
