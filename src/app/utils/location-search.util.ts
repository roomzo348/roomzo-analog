import prayagrajLocations from '../../../public/prayagraj_locations.json';
import cityZonesData from '../../../public/data/city-zones.json';

export interface RoomzoLocalLocation {
  id: string;
  name: string;
  category: string;
  parent: string;
  latitude: number;
  longitude: number;
  tags?: string[];
}

export interface LocationSearchResult {
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  address?: {
    neighbourhood?: string;
    suburb?: string;
    village?: string;
    town?: string;
    city?: string;
    county?: string;
    state_district?: string;
    state?: string;
  };
  importance?: number;
  roomzoZone?: string;
  roomzoCity?: string;
  roomzoSource?: 'local' | 'city' | 'zone' | 'nominatim';
}

export interface RoomzoCityCenter {
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  aliases?: string[];
}

/** Active Roomzo city centers — used for city autosuggest + nearest search. */
export const ROOMZO_CITY_CENTERS: RoomzoCityCenter[] = [
  {
    name: 'Prayagraj',
    state: 'Uttar Pradesh',
    latitude: 25.4358,
    longitude: 81.8463,
    aliases: ['allahabad'],
  },
  {
    name: 'Varanasi',
    state: 'Uttar Pradesh',
    latitude: 25.3176,
    longitude: 82.9739,
    aliases: ['banaras', 'kashi'],
  },
  {
    name: 'Pune',
    state: 'Maharashtra',
    latitude: 18.5204,
    longitude: 73.8567,
  },
  {
    name: 'Lucknow',
    state: 'Uttar Pradesh',
    latitude: 26.8467,
    longitude: 80.9462,
  },
];

/**
 * City-page zone names → approximate coords (and aliases for local JSON names).
 * Keeps explore chips / landmark zones aligned with city-zones.json.
 */
const ZONE_COORD_OVERRIDES: Record<string, { lat: number; lng: number; aliases?: string[] }> = {
  Allahpur: { lat: 25.4482, lng: 81.8756, aliases: ['allahapur'] },
  'Civil Lines': { lat: 25.455, lng: 81.835 },
  Phaphamau: { lat: 25.5167, lng: 81.8667 },
  'Stanley Road': { lat: 25.442, lng: 81.852 },
  Teliyarganj: { lat: 25.494, lng: 81.863 },
  George: { lat: 25.443, lng: 81.859, aliases: ['george town'] },
  Jhusi: { lat: 25.428, lng: 81.91, aliases: ['jhusi (jusi)', 'jusi'] },
  Katra: { lat: 25.447, lng: 81.832 },
  Mutthiganj: { lat: 25.435, lng: 81.845 },
  Naini: { lat: 25.38, lng: 81.87 },
  'Koregaon Park': { lat: 18.5362, lng: 73.8937 },
  'Viman Nagar': { lat: 18.5679, lng: 73.9143 },
};

const LOCAL_LOCATIONS = prayagrajLocations as RoomzoLocalLocation[];
const CITY_ZONES = cityZonesData as Record<string, Array<{ name: string; imageUrl?: string }>>;

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function scoreNameMatch(query: string, name: string): number {
  const q = normalize(query);
  const n = normalize(name);
  if (!q || !n) return 0;
  if (n === q) return 120;
  if (n.startsWith(q)) return 90;
  if (n.includes(q)) return 70;
  if (q.includes(n) && n.length >= 4) return 50;
  return 0;
}

function scoreLocalLocation(query: string, location: RoomzoLocalLocation): number {
  let score = scoreNameMatch(query, location.name);
  if (!score) return 0;

  for (const tag of location.tags ?? []) {
    const tagValue = normalize(tag);
    const q = normalize(query);
    if (tagValue === q) score += 35;
    else if (tagValue.includes(q) && q.length >= 5) score += 12;
  }

  if (location.category === 'Sub-Area') score += 8;
  return score;
}

function scoreNominatimResult(query: string, result: LocationSearchResult): number {
  const q = normalize(query);
  if (!q) return 0;

  const name = normalize(result.name ?? '');
  const display = normalize(result.display_name ?? '');
  const suburb = normalize(result.address?.suburb ?? '');
  const neighbourhood = normalize(result.address?.neighbourhood ?? '');
  const city = normalize(
    result.address?.city ?? result.address?.town ?? result.address?.state_district ?? ''
  );
  const state = normalize(result.address?.state ?? '');

  let score = (result.importance ?? 0) * 10;

  if (name === q || suburb === q || neighbourhood === q) score += 100;
  else if (name.includes(q) || suburb.includes(q) || neighbourhood.includes(q)) score += 70;
  else if (display.includes(q)) score += 50;

  for (const word of q.split(' ')) {
    if (word.length < 3) continue;
    if (
      name.includes(word) ||
      suburb.includes(word) ||
      neighbourhood.includes(word) ||
      display.includes(word)
    ) {
      score += 12;
    }
  }

  if (
    ROOMZO_CITY_CENTERS.some((c) => {
      const cityName = normalize(c.name);
      return (
        city.includes(cityName) ||
        display.includes(cityName) ||
        (c.aliases ?? []).some((a) => city.includes(a) || display.includes(a))
      );
    })
  ) {
    score += 30;
  }

  if (state.includes('uttar pradesh') || state.includes('maharashtra')) {
    score += 5;
  }

  return score;
}

export function localLocationToSearchResult(location: RoomzoLocalLocation): LocationSearchResult {
  return {
    lat: String(location.latitude),
    lon: String(location.longitude),
    name: location.name,
    display_name: `${location.name}, ${location.parent}, Uttar Pradesh, India`,
    address: {
      suburb: location.name,
      city: location.parent,
      state: 'Uttar Pradesh',
    },
    roomzoZone: location.name,
    roomzoCity: location.parent,
    roomzoSource: 'local',
  };
}

export function cityCenterToSearchResult(city: RoomzoCityCenter): LocationSearchResult {
  return {
    lat: String(city.latitude),
    lon: String(city.longitude),
    name: city.name,
    display_name: `${city.name}, ${city.state}, India`,
    address: {
      city: city.name,
      state: city.state,
    },
    roomzoCity: city.name,
    roomzoSource: 'city',
  };
}

export function getZonesForCity(cityName: string): string[] {
  if (!cityName?.trim()) return [];
  const key = Object.keys(CITY_ZONES).find((k) => normalize(k) === normalize(cityName));
  if (!key) return [];
  return (CITY_ZONES[key] ?? []).map((z) => z.name);
}

/** Zone suggestions for landmark field — always includes city zones; filters when typing. */
export function suggestZonesForLandmark(cityName: string, query = ''): string[] {
  const zones = getZonesForCity(cityName);
  const q = normalize(query);
  if (!q) return zones;
  return zones
    .map((name) => ({ name, score: scoreNameMatch(query, name) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.name);
}

export function resolveZoneName(raw: string): string {
  const q = normalize(raw);
  if (!q) return raw.trim();

  for (const [canonical, meta] of Object.entries(ZONE_COORD_OVERRIDES)) {
    if (normalize(canonical) === q) return canonical;
    if ((meta.aliases ?? []).some((a) => a === q)) return canonical;
  }

  for (const location of LOCAL_LOCATIONS) {
    if (normalize(location.name) === q) return location.name;
  }

  return raw.trim();
}

export function getKnownZoneCoordinates(zoneName: string): { lat: number; lng: number } | null {
  const q = normalize(zoneName);
  if (!q) return null;

  for (const [canonical, meta] of Object.entries(ZONE_COORD_OVERRIDES)) {
    if (normalize(canonical) === q || (meta.aliases ?? []).some((a) => a === q)) {
      return { lat: meta.lat, lng: meta.lng };
    }
  }

  const match = LOCAL_LOCATIONS.find((location) => normalize(location.name) === q);
  if (match) return { lat: match.latitude, lng: match.longitude };
  return null;
}

export function getCityCenter(cityOrAlias: string): RoomzoCityCenter | null {
  const q = normalize(cityOrAlias);
  return (
    ROOMZO_CITY_CENTERS.find(
      (c) => normalize(c.name) === q || (c.aliases ?? []).some((a) => a === q)
    ) ?? null
  );
}

function searchRoomzoCities(query: string, limit = 4): LocationSearchResult[] {
  const q = normalize(query);
  if (q.length < 1) return [];

  return ROOMZO_CITY_CENTERS
    .map((city) => {
      let score = scoreNameMatch(query, city.name);
      for (const alias of city.aliases ?? []) {
        score = Math.max(score, scoreNameMatch(query, alias));
      }
      return { city, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => cityCenterToSearchResult(entry.city));
}

function searchConfiguredZones(query: string, limit = 6): LocationSearchResult[] {
  const q = normalize(query);
  if (q.length < 2) return [];

  const results: Array<{ result: LocationSearchResult; score: number }> = [];

  for (const [cityName, zones] of Object.entries(CITY_ZONES)) {
    const city = getCityCenter(cityName);
    for (const zone of zones ?? []) {
      const score = scoreNameMatch(query, zone.name);
      if (score <= 0) continue;
      const coords =
        getKnownZoneCoordinates(zone.name) ??
        (city ? { lat: city.latitude, lng: city.longitude } : null);
      if (!coords) continue;
      results.push({
        score: score + 10,
        result: {
          lat: String(coords.lat),
          lon: String(coords.lng),
          name: zone.name,
          display_name: `${zone.name}, ${cityName}, India`,
          address: {
            suburb: zone.name,
            city: cityName,
            state: city?.state || 'Uttar Pradesh',
          },
          roomzoZone: zone.name,
          roomzoCity: cityName,
          roomzoSource: 'zone',
        },
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.result);
}

export function searchLocalLocations(query: string, limit = 6): LocationSearchResult[] {
  const q = normalize(query);
  if (q.length < 2) return [];

  return LOCAL_LOCATIONS
    .map((location) => ({ location, score: scoreLocalLocation(query, location) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => localLocationToSearchResult(entry.location));
}

/** Prefer Roomzo cities + zones, then local Prayagraj gazetteer, then Nominatim. */
export function rankLocationResults(
  query: string,
  nominatimResults: LocationSearchResult[],
  limit = 6
): LocationSearchResult[] {
  const preferred = [
    ...searchRoomzoCities(query, 4),
    ...searchConfiguredZones(query, limit),
    ...searchLocalLocations(query, limit),
  ];
  const seen = new Set<string>();

  const deduped = [...preferred, ...nominatimResults].filter((result) => {
    const key = `${Number(result.lat).toFixed(4)}:${Number(result.lon).toFixed(4)}:${normalize(
      result.roomzoZone || result.name || ''
    )}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped
    .map((result) => {
      let score = 0;
      if (result.roomzoSource === 'city') {
        score = scoreNameMatch(query, result.name || '') + 40;
      } else if (result.roomzoSource === 'zone' || result.roomzoSource === 'local') {
        score = scoreNameMatch(query, result.roomzoZone || result.name || '') + 20;
      } else {
        score = scoreNominatimResult(query, result);
      }
      return { result, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.result);
}

export function buildGeocodeQueries(text: string): string[] {
  const trimmed = text.trim();
  const queries = new Set<string>();

  const city = getCityCenter(trimmed.split(',')[0].trim());
  if (city) {
    queries.add(`${city.name}, ${city.state}, India`);
    return [...queries];
  }

  const zonePart = trimmed.split(',')[0].trim();
  const zoneCoords = getKnownZoneCoordinates(zonePart);
  if (zoneCoords) {
    const resolved = resolveZoneName(zonePart);
    const cityHint =
      trimmed.includes(',')
        ? trimmed.split(',').slice(1).join(',').trim()
        : 'Prayagraj';
    queries.add(`${resolved}, ${cityHint}, India`);
  }

  const matchedCity = ROOMZO_CITY_CENTERS.find((c) =>
    normalize(trimmed).includes(normalize(c.name))
  );
  if (matchedCity) {
    queries.add(`${trimmed}, ${matchedCity.state}, India`);
  } else {
    queries.add(`${trimmed}, Uttar Pradesh, India`);
    queries.add(`${trimmed}, Maharashtra, India`);
  }
  queries.add(trimmed);
  return [...queries];
}

/** Resolve typed text to lat/lng without waiting for Nominatim when possible. */
export function resolveLocalCoordinates(
  text: string
): { lat: number; lng: number; label: string; city?: string; state?: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const primary = trimmed.split(',')[0].trim();
  const city = getCityCenter(primary) || getCityCenter(trimmed);
  if (city) {
    return {
      lat: city.latitude,
      lng: city.longitude,
      label: city.name,
      city: city.name,
      state: city.state,
    };
  }

  const zoneCoords = getKnownZoneCoordinates(primary);
  if (zoneCoords) {
    const zoneName = resolveZoneName(primary);
    const cityFromText =
      trimmed
        .split(',')
        .slice(1)
        .map((p) => p.trim())
        .find((p) => !!getCityCenter(p)) || 'Prayagraj';
    const cityMeta = getCityCenter(cityFromText);
    return {
      lat: zoneCoords.lat,
      lng: zoneCoords.lng,
      label: zoneName,
      city: cityMeta?.name || cityFromText,
      state: cityMeta?.state || 'Uttar Pradesh',
    };
  }

  const local = searchLocalLocations(trimmed, 1)[0];
  if (local) {
    return {
      lat: parseFloat(local.lat),
      lng: parseFloat(local.lon),
      label: local.roomzoZone || local.name || trimmed,
      city: local.address?.city,
      state: local.address?.state,
    };
  }

  return null;
}
