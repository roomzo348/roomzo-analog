/**
 * Central city registry — add new cities here to auto-enable SEO pages,
 * sitemap entries, footer links, and internal linking.
 */
export interface RoomzoCity {
  name: string;
  state: string;
  slug: string;
  active: boolean;
  heroImage: string;
  seoTitle?: string;
  seoDescription?: string;
  localKeywords?: string[];
  aliases?: string[];
}

export const ROOMZO_CITIES: RoomzoCity[] = [
  {
    name: 'Prayagraj',
    state: 'Uttar Pradesh',
    slug: 'prayagraj',
    active: true,
    heroImage: 'prayagraj.jpeg',
    localKeywords: ['katra room rent', 'civil lines flats', 'allahabad university pg', 'naini room', 'dhoomanganj pg'],
  },
  {
    name: 'Varanasi',
    state: 'Uttar Pradesh',
    slug: 'varanasi',
    active: true,
    heroImage: 'banaras.jpg',
    aliases: ['banaras', 'kashi'],
    localKeywords: ['bhu pg', 'lanka varanasi room', 'assi ghat flat', 'sigra pg', 'sarnath room rent'],
  },
  {
    name: 'Pune',
    state: 'Maharashtra',
    slug: 'pune',
    active: true,
    heroImage: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1600&q=80',
    localKeywords: ['hinjewadi pg', 'viman nagar flat', 'kothrud room', 'wakad pg', 'baner flat for rent'],
  },
  {
    name: 'Lucknow',
    state: 'Uttar Pradesh',
    slug: 'lucknow',
    active: true,
    heroImage: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=1600&q=80',
    localKeywords: ['gomti nagar flat', 'hazratganj room', 'alambagh pg'],
  },
  // {
  //   name: 'Delhi',
  //   state: 'Delhi',
  //   slug: 'delhi',
  //   active: true,
  //   heroImage: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=1600&q=80',
  //   localKeywords: ['south delhi pg', 'dwarka flat', 'noida room rent'],
  // },
  // {
  //   name: 'Bangalore',
  //   state: 'Karnataka',
  //   slug: 'bangalore',
  //   active: true,
  //   heroImage: 'https://images.unsplash.com/photo-1596176530734-9dce9708faec?w=1600&q=80',
  //   aliases: ['bengaluru'],
  //   localKeywords: ['koramangala pg', 'whitefield flat', 'indiranagar room'],
  // },
  // {
  //   name: 'Hyderabad',
  //   state: 'Telangana',
  //   slug: 'hyderabad',
  //   active: true,
  //   heroImage: 'https://images.unsplash.com/photo-1569770230334-eff945a32b0?w=1600&q=80',
  //   localKeywords: ['gachibowli pg', 'hitech city flat', 'kukatpally room'],
  // },
  {
    name: 'Mumbai',
    state: 'Maharashtra',
    slug: 'mumbai',
    active: false,
    heroImage: 'https://images.unsplash.com/photo-1522256658092-1279a04a6fc6?w=1600&q=80',
    localKeywords: ['andheri pg', 'bandra flat', 'powai room rent'],
  },
  {
    name: 'Jaipur',
    state: 'Rajasthan',
    slug: 'jaipur',
    active: false,
    heroImage: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=1600&q=80',
    localKeywords: ['malviya nagar pg', 'vaishali nagar flat'],
  },
  {
    name: 'Kota',
    state: 'Rajasthan',
    slug: 'kota',
    active: false,
    heroImage: 'https://images.unsplash.com/photo-1565019018445-560b435af769?w=1600&q=80',
    localKeywords: ['coaching hostel kota', 'vigyan nagar pg'],
  },
  {
    name: 'Chennai',
    state: 'Tamil Nadu',
    slug: 'chennai',
    active: false,
    heroImage: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1600&q=80',
    localKeywords: ['omr pg', 'velachery flat'],
  },
  {
    name: 'Indore',
    state: 'Madhya Pradesh',
    slug: 'indore',
    active: false,
    heroImage: 'https://images.unsplash.com/photo-1596178065887-11911b8d0a0a?w=1600&q=80',
    localKeywords: ['vijay nagar pg', 'bhawarkua room'],
  },
];

export function slugifyCity(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getCityBySlug(slug: string): RoomzoCity | undefined {
  const normalized = slug.toLowerCase();
  return ROOMZO_CITIES.find(
    (c) =>
      c.slug === normalized ||
      c.aliases?.some((a) => a.toLowerCase() === normalized)
  );
}

export function getActiveCities(): RoomzoCity[] {
  return ROOMZO_CITIES.filter((c) => c.active);
}

export function getCitySeoTitle(city: RoomzoCity): string {
  return (
    city.seoTitle ??
    `Rooms, PG & Flats for Rent in ${city.name} | Direct Owner Contact | Roomzo`
  );
}

export function getCitySeoDescription(city: RoomzoCity): string {
  return (
    city.seoDescription ??
    `Browse owner-listed rooms, PGs, and flats for rent in ${city.name}, ${city.state}. Compare options on Roomzo, contact owners directly, and follow our safety tips before you pay or move in.`
  );
}

export function getCityKeywords(city: RoomzoCity): string[] {
  const base = [
    `room for rent in ${city.name.toLowerCase()}`,
    `pg in ${city.name.toLowerCase()}`,
    `flat for rent ${city.name.toLowerCase()}`,
    `student housing ${city.name.toLowerCase()}`,
    `brokerless property ${city.name.toLowerCase()}`,
    `no broker ${city.name.toLowerCase()}`,
  ];
  return [...base, ...(city.localKeywords ?? [])];
}

export function buildCityPath(city: RoomzoCity): string {
  return `/city/${city.slug}`;
}
