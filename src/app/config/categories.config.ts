/** SEO category landing pages — maps slug to explore-listing filters. */
export interface RoomzoCategory {
  slug: string;
  label: string;
  propertyType?: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  relatedTerms: string[];
}

export const ROOMZO_CATEGORIES: RoomzoCategory[] = [
  {
    slug: 'rooms-for-rent',
    label: 'Rooms for Rent',
    propertyType: 'Room',
    seoTitle: 'Rooms for Rent | Direct Owner Contact | Roomzo',
    seoDescription:
      'Browse owner-listed single and shared rooms for rent. Compare photos, rent, and amenities on Roomzo, then contact owners directly — with safety tips before you pay.',
    keywords: ['room for rent', 'single room rent', 'owner listed room', 'student room'],
    relatedTerms: ['pg for rent', 'flat for rent', 'hostel near me'],
  },
  {
    slug: 'student-housing',
    label: 'Student Housing',
    propertyType: 'PG',
    seoTitle: 'Student Housing & PG Near Colleges | Roomzo',
    seoDescription:
      'Explore student-friendly PGs, shared rooms, and flats near colleges. Practical guides plus owner-listed options on Roomzo for cities across India.',
    keywords: ['student housing', 'pg near college', 'hostel for students', 'coaching hostel'],
    relatedTerms: ['bhu pg', 'allahabad university room', 'kota coaching hostel'],
  },
  {
    slug: 'pg-for-rent',
    label: 'PG for Rent',
    propertyType: 'PG',
    seoTitle: 'PG for Rent | Boys & Girls PG | Roomzo',
    seoDescription:
      'Find boys and girls PG listings with details on meals, WiFi, and rules. Contact caretakers or owners directly through Roomzo after reviewing our safety checklist.',
    keywords: ['pg for rent', 'paying guest', 'boys pg', 'girls pg', 'furnished pg'],
    relatedTerms: ['pg with food', 'single occupancy pg', 'pg near metro'],
  },
  {
    slug: 'flats-for-rent',
    label: 'Flats for Rent',
    propertyType: 'Flat',
    seoTitle: 'Flats for Rent | 1BHK 2BHK | Owner Listings | Roomzo',
    seoDescription:
      'Browse 1BHK, 2BHK, and family flats listed by owners. Use Roomzo to shortlist properties and contact owners — always visit before paying a deposit.',
    keywords: ['flat for rent', '1bhk rent', '2bhk flat', 'family flat rent'],
    relatedTerms: ['furnished flat', 'semi furnished flat', 'apartment for rent'],
  },
  {
    slug: 'brokerless-property',
    label: 'Brokerless Property',
    seoTitle: 'Direct Owner Rentals | Platform Guide | Roomzo',
    seoDescription:
      'Learn how Roomzo connects tenants with property owners for rooms, PGs, and flats. We are a listing platform — verify every property offline before you pay.',
    keywords: ['brokerless property', 'no broker rent', 'direct owner rent', 'rental platform'],
    relatedTerms: ['alternatives to 99acres', 'housing.com without broker', 'nobroker alternative'],
  },
];

export function getCategoryBySlug(slug: string): RoomzoCategory | undefined {
  return ROOMZO_CATEGORIES.find((c) => c.slug === slug.toLowerCase());
}

export function buildCategoryPath(category: RoomzoCategory): string {
  return `/category/${category.slug}`;
}
