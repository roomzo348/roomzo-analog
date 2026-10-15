import { sqlQuery } from '../db/mysql';
import { haversineMeters, normalizeAddressPart, normalizePhone } from './listing-duplicate.util';

export type DuplicateKind = 'hard' | 'soft' | 'ok';
export { haversineMeters, normalizeAddressPart, normalizePhone, digitsOnly } from './listing-duplicate.util';

export interface DuplicateCheckInput {
  city?: string | null;
  street?: string | null;
  landmark?: string | null;
  zone?: string | null;
  propertyName?: string | null;
  bedrooms?: number | null;
  rentAmount?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  excludeListingId?: number | null;
}

export interface DuplicateCheckResult {
  kind: DuplicateKind;
  matchId?: number;
  reason?: string;
}

const HARD_RENT_TOLERANCE = 0.1;
const SOFT_RENT_TOLERANCE = 0.15;
const HARD_DISTANCE_M = 80;

function namesSimilar(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 6 && b.length >= 6 && (a.includes(b) || b.includes(a))) return true;
  return false;
}

function rentWithin(a: number, b: number, tolerance: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return false;
  const max = Math.max(a, b);
  const min = Math.min(a, b);
  return (max - min) / max <= tolerance;
}

export async function findListingDuplicates(
  input: DuplicateCheckInput
): Promise<DuplicateCheckResult> {
  const phone = normalizePhone(input.phone);
  const city = normalizeAddressPart(input.city);
  const street = normalizeAddressPart(input.street);
  const landmark = normalizeAddressPart(input.landmark);
  const zone = normalizeAddressPart(input.zone);
  const name = normalizeAddressPart(input.propertyName);
  const lat = Number(input.latitude);
  const lng = Number(input.longitude);
  const rent = Number(input.rentAmount);
  const bedrooms = Number(input.bedrooms);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const excludeId = Number(input.excludeListingId) || 0;

  const clauses: string[] = [
    `(moderation_status IS NULL OR moderation_status IN ('pending', 'approved'))`,
  ];
  const params: unknown[] = [];
  const orParts: string[] = [];

  if (phone.length >= 10) {
    orParts.push(`temp_contact_no LIKE ?`);
    params.push(`%${phone}%`);
  }
  if (city) {
    orParts.push(`LOWER(TRIM(city)) = ?`);
    params.push(city);
  }
  if (hasCoords) {
    const delta = HARD_DISTANCE_M / 111000 + 0.001;
    orParts.push(`(latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?)`);
    params.push(lat - delta, lat + delta, lng - delta, lng + delta);
  }
  if (!orParts.length) {
    return { kind: 'ok' };
  }
  clauses.push(`(${orParts.join(' OR ')})`);
  if (excludeId > 0) {
    clauses.push(`id <> ?`);
    params.push(excludeId);
  }

  const rows = await sqlQuery<any>(
    `SELECT id, city, street, landmark, zone, property_name, bedrooms, rent_amount,
            latitude, longitude, temp_contact_no
     FROM property_listings
     WHERE ${clauses.join(' AND ')}
     LIMIT 250`,
    params
  );

  let soft: DuplicateCheckResult | null = null;

  for (const row of rows) {
    const id = Number(row.id);
    const rowPhone = normalizePhone(row.temp_contact_no);
    const rowCity = normalizeAddressPart(row.city);
    const rowStreet = normalizeAddressPart(row.street);
    const rowLandmark = normalizeAddressPart(row.landmark);
    const rowZone = normalizeAddressPart(row.zone);
    const rowName = normalizeAddressPart(row.property_name);
    const rowRent = Number(row.rent_amount);
    const rowBeds = Number(row.bedrooms);
    const rowLat = Number(row.latitude);
    const rowLng = Number(row.longitude);

    if (phone.length >= 10 && rowPhone === phone) {
      return { kind: 'hard', matchId: id, reason: 'duplicate_phone' };
    }

    const sameCity = Boolean(city && rowCity && city === rowCity);
    const sameStreetOrLandmark =
      Boolean(street && rowStreet && street === rowStreet) ||
      Boolean(landmark && rowLandmark && landmark === rowLandmark);
    if (sameCity && sameStreetOrLandmark && rentWithin(rent, rowRent, HARD_RENT_TOLERANCE)) {
      return { kind: 'hard', matchId: id, reason: 'duplicate_address' };
    }

    if (
      sameCity &&
      hasCoords &&
      Number.isFinite(rowLat) &&
      Number.isFinite(rowLng) &&
      haversineMeters(lat, lng, rowLat, rowLng) <= HARD_DISTANCE_M
    ) {
      return { kind: 'hard', matchId: id, reason: 'duplicate_location' };
    }

    if (!soft && sameCity && namesSimilar(name, rowName)) {
      soft = { kind: 'soft', matchId: id, reason: 'similar_name' };
    }
    if (
      !soft &&
      zone &&
      rowZone &&
      zone === rowZone &&
      Number.isFinite(bedrooms) &&
      bedrooms === rowBeds &&
      rentWithin(rent, rowRent, SOFT_RENT_TOLERANCE)
    ) {
      soft = { kind: 'soft', matchId: id, reason: 'similar_zone_rent' };
    }
  }

  return soft ?? { kind: 'ok' };
}
