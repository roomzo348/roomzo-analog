import prayagrajLocations from '../../../public/prayagraj_locations.json';

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
  roomzoSource?: 'local' | 'nominatim';
}

const ROOMZO_CITIES = ['prayagraj', 'allahabad', 'varanasi', 'pune', 'lucknow'];
const LOCAL_LOCATIONS = prayagrajLocations as RoomzoLocalLocation[];

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function scoreLocalLocation(query: string, location: RoomzoLocalLocation): number {
  const q = normalize(query);
  if (!q) return 0;

  const name = normalize(location.name);
  let score = 0;

  if (name === q) score += 120;
  else if (name.startsWith(q)) score += 90;
  else if (name.includes(q)) score += 70;
  else if (q.includes(name) && name.length >= 4) score += 50;

  for (const tag of location.tags ?? []) {
    const tagValue = normalize(tag);
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
  const city = normalize(result.address?.city ?? result.address?.town ?? result.address?.state_district ?? '');
  const state = normalize(result.address?.state ?? '');

  let score = (result.importance ?? 0) * 10;

  if (name === q || suburb === q || neighbourhood === q) score += 100;
  else if (name.includes(q) || suburb.includes(q) || neighbourhood.includes(q)) score += 70;
  else if (display.includes(q)) score += 50;

  for (const word of q.split(' ')) {
    if (word.length < 3) continue;
    if (name.includes(word) || suburb.includes(word) || neighbourhood.includes(word) || display.includes(word)) {
      score += 12;
    }
  }

  if (ROOMZO_CITIES.some((roomzoCity) => city.includes(roomzoCity) || display.includes(roomzoCity))) {
    score += 25;
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
    roomzoSource: 'local',
  };
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

export function rankLocationResults(
  query: string,
  nominatimResults: LocationSearchResult[],
  limit = 6
): LocationSearchResult[] {
  const localResults = searchLocalLocations(query, limit);
  const seen = new Set<string>();

  const deduped = [...localResults, ...nominatimResults].filter((result) => {
    const key = `${result.lat}:${result.lon}:${result.name ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped
    .map((result) => ({
      result,
      score: result.roomzoSource === 'local'
        ? scoreLocalLocation(query, {
            id: result.roomzoZone ?? result.name ?? '',
            name: result.roomzoZone ?? result.name ?? '',
            category: 'Sub-Area',
            parent: result.address?.city ?? 'Prayagraj',
            latitude: Number(result.lat),
            longitude: Number(result.lon),
            tags: [],
          })
        : scoreNominatimResult(query, result),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.result);
}

export function buildGeocodeQueries(text: string): string[] {
  const trimmed = text.trim();
  const localMatch = searchLocalLocations(trimmed, 1)[0];
  const queries = new Set<string>();

  if (localMatch?.roomzoZone) {
    queries.add(`${localMatch.roomzoZone}, Prayagraj, Uttar Pradesh`);
  }

  queries.add(`${trimmed}, Prayagraj, Uttar Pradesh`);
  queries.add(`${trimmed}, Uttar Pradesh`);
  queries.add(trimmed);
  return [...queries];
}

export function getKnownZoneCoordinates(zoneName: string): { lat: number; lng: number } | null {
  const match = LOCAL_LOCATIONS.find(
    (location) => normalize(location.name) === normalize(zoneName)
  );
  if (!match) return null;
  return { lat: match.latitude, lng: match.longitude };
}
