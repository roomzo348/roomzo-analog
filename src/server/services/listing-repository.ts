import type { ResultSetHeader } from 'mysql2';
import { sqlExecute, sqlQuery } from '../db/mysql';
import { getServerRuntime } from '../utils/runtime-config';

export interface ListingSearchInput {
  page: number;
  size: number;
  minPrice?: number;
  maxPrice?: number;
  propertyType?: string;
  bedrooms?: number;
  isRented?: number;
  lat?: number;
  lng?: number;
  sortBy?: string;
  city?: string;
  state?: string;
  zone?: string;
}

export async function getListingById(id: number): Promise<any | null> {
  const rows = await sqlQuery<any>(
    `SELECT * FROM property_listings WHERE id = ? LIMIT 1`,
    [id]
  );
  const listing = rows[0];
  if (!listing) return null;
  return hydrateListings([listing]).then((list) => list[0] ?? null);
}

export async function getListingsByIds(ids: number[]): Promise<any[]> {
  const uniqueIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
  if (!uniqueIds.length) return [];
  const marks = uniqueIds.map(() => '?').join(',');
  const rows = await sqlQuery<any>(
    `SELECT * FROM property_listings WHERE id IN (${marks})`,
    uniqueIds
  );
  return hydrateListings(rows);
}

export async function getOwnerName(ownerId: number | null | undefined): Promise<string | null> {
  if (!ownerId) return null;
  const rows = await sqlQuery<{ name: string | null; email: string | null }>(
    `SELECT name, email FROM users WHERE id = ? LIMIT 1`,
    [ownerId]
  );
  if (!rows[0]) return null;
  const value = rows[0].name;
  if (!value || value === rows[0].email) return null;
  return value;
}

export async function getOwnerListings(ownerId: number): Promise<any[]> {
  const rows = await sqlQuery<any>(
    `SELECT * FROM property_listings WHERE owner_id = ? ORDER BY created_on DESC`,
    [ownerId]
  );
  return hydrateListings(rows);
}

export async function setListingStatus(id: number, status: number): Promise<boolean> {
  const result = await sqlExecute(`UPDATE property_listings SET is_rented = ? WHERE id = ?`, [
    status,
    id,
  ]);
  return result.affectedRows > 0;
}

export async function deleteListing(id: number): Promise<boolean> {
  await sqlExecute(`DELETE FROM property_photos WHERE listing_id = ?`, [id]);
  await sqlExecute(`DELETE FROM guidebook_rules WHERE guidebook_id IN (SELECT id FROM listing_guidebook WHERE listing_id = ?)`, [id]);
  await sqlExecute(`DELETE FROM guidebook_nearby WHERE guidebook_id IN (SELECT id FROM listing_guidebook WHERE listing_id = ?)`, [id]);
  await sqlExecute(`DELETE FROM listing_guidebook WHERE listing_id = ?`, [id]);
  const result = await sqlExecute(`DELETE FROM property_listings WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

function buildFilterWhere(filters: ListingSearchInput, values: unknown[]): string {
  const where: string[] = [`(p.is_rented IS NULL OR p.is_rented <> 2)`];
  if (filters.isRented != null) {
    where.push(`p.is_rented = ?`);
    values.push(filters.isRented);
  }
  if (filters.maxPrice != null) {
    where.push(`p.rent_amount <= ?`);
    values.push(filters.maxPrice);
  }
  if (filters.minPrice != null) {
    where.push(`p.rent_amount >= ?`);
    values.push(filters.minPrice);
  }
  if (filters.propertyType) {
    where.push(`p.property_type = ?`);
    values.push(filters.propertyType);
  }
  if (filters.bedrooms != null) {
    where.push(`p.bedrooms >= ?`);
    values.push(filters.bedrooms);
  }
  if (filters.city) {
    where.push(`LOWER(p.city) = LOWER(?)`);
    values.push(filters.city);
  }
  if (filters.state) {
    where.push(`LOWER(p.state) = LOWER(?)`);
    values.push(filters.state);
  }
  if (filters.zone) {
    where.push(`LOWER(p.zone) = LOWER(?)`);
    values.push(filters.zone);
  }
  return where.join(' AND ');
}

function buildDistanceExpression(): string {
  return `6371 * acos(GREATEST(-1, LEAST(1, cos(radians(?)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(?)) + sin(radians(?)) * sin(radians(p.latitude)))))`;
}

export async function searchListings(filters: ListingSearchInput): Promise<{
  listings: any[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}> {
  const page = Math.max(0, Number(filters.page || 0));
  const size = Math.max(1, Math.min(100, Number(filters.size || 6)));
  const offset = page * size;
  const params: unknown[] = [];
  const where = buildFilterWhere(filters, params);

  let locationClause = '';
  let orderBy = 'p.created_on DESC';
  let distanceParams: unknown[] = [];
  const sort = (filters.sortBy || 'latest').toLowerCase();

  if (filters.lat != null && filters.lng != null) {
    const radiusKm = getServerRuntime().nearbySearchRadiusKm;
    const lat = Number(filters.lat);
    const lng = Number(filters.lng);
    const latDelta = radiusKm / 111.0;
    const lngDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));
    const distExpr = buildDistanceExpression();
    locationClause = ` AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
      AND p.latitude BETWEEN ? AND ?
      AND p.longitude BETWEEN ? AND ?
      AND (${distExpr}) <= ?`;
    distanceParams = [
      lat - latDelta,
      lat + latDelta,
      lng - lngDelta,
      lng + lngDelta,
      lat,
      lng,
      lat,
      radiusKm,
    ];

    if (sort === 'nearest') {
      orderBy = `(${distExpr}) ASC, p.created_on DESC`;
      distanceParams.push(lat, lng, lat);
    } else if (sort === 'oldest') {
      orderBy = 'p.created_on ASC';
    } else {
      orderBy = 'p.created_on DESC';
    }
  } else if (sort === 'oldest') {
    orderBy = 'p.created_on ASC';
  }

  const countRows = await sqlQuery<{ total: number }>(
    `SELECT COUNT(*) as total FROM property_listings p WHERE ${where}${locationClause}`,
    [...params, ...distanceParams]
  );
  const totalItems = Number(countRows[0]?.total ?? 0);
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / size);

  const listRows = await sqlQuery<any>(
    `SELECT p.* FROM property_listings p
     WHERE ${where}${locationClause}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, ...distanceParams, size, offset]
  );
  const listings = await hydrateListings(listRows);
  return { listings, totalItems, totalPages, currentPage: page };
}

export async function getFeaturedListings(limit: number): Promise<any[]> {
  const rows = await sqlQuery<any>(
    `SELECT * FROM property_listings
     WHERE COALESCE(is_featured, 0) = 1 AND (is_rented IS NULL OR is_rented = 0)
     ORDER BY COALESCE(featured_priority, 0) DESC, created_on DESC
     LIMIT ?`,
    [limit]
  );
  return hydrateListings(rows);
}

export async function getRecentListings(limit: number): Promise<any[]> {
  const rows = await sqlQuery<any>(
    `SELECT * FROM property_listings
     WHERE (is_rented IS NULL OR is_rented = 0)
     ORDER BY created_on DESC
     LIMIT ?`,
    [limit]
  );
  return hydrateListings(rows);
}

export async function createListing(payload: any): Promise<number> {
  const details = payload?.details ?? {};
  const address = details?.address ?? {};
  const amenities = payload?.amenities ?? {};
  const conditions = payload?.conditions ?? {};
  const finalInfo = payload?.final ?? {};

  const result = await sqlExecute(
    `INSERT INTO property_listings (
      owner_id, property_name, property_type, property_size, bedrooms, bathrooms,
      street, city, state, zip_code, landmark, latitude, longitude,
      has_bed, has_almirah, has_study_table, has_fan_light, has_ro_water, has_inverter, has_cooling, has_geyser, has_wifi, has_parking, has_cctv, has_washing_machine, has_kitchen,
      couple_friendly, for_boys, for_girls, water24x7, veg_only, family_friendly, students_only, working_professionals,
      rent_amount, description, is_rented, temp_contact_no, zone
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      Number(payload?.ownerId),
      details?.propertyName ?? null,
      details?.propertyType ?? null,
      details?.propertySize ?? null,
      details?.bedrooms ?? null,
      details?.bathrooms ?? null,
      address?.street ?? null,
      address?.city ?? null,
      address?.state ?? null,
      address?.zipCode ?? address?.zip ?? null,
      address?.landmark ?? null,
      address?.latitude ?? null,
      address?.longitude ?? null,
      bool(amenities?.hasBed ?? amenities?.bed),
      bool(amenities?.hasAlmirah),
      bool(amenities?.hasStudyTable),
      bool(amenities?.hasFanLight),
      bool(amenities?.hasRoWater),
      bool(amenities?.hasInverter),
      bool(amenities?.hasCooling),
      bool(amenities?.hasGeyser),
      bool(amenities?.hasWifi ?? amenities?.wifi),
      bool(amenities?.hasParking ?? amenities?.parking),
      bool(amenities?.hasCctv),
      bool(amenities?.hasWashingMachine),
      bool(amenities?.hasKitchen),
      bool(conditions?.coupleFriendly),
      bool(conditions?.forBoys),
      bool(conditions?.forGirls),
      bool(conditions?.water24x7),
      bool(conditions?.vegOnly),
      bool(conditions?.familyFriendly),
      bool(conditions?.studentsOnly),
      bool(conditions?.workingProfessionals),
      finalInfo?.rentAmount ?? null,
      finalInfo?.description ?? null,
      0,
      finalInfo?.contactNo ?? null,
      address?.zone ?? null,
    ]
  );

  const listingId = (result as ResultSetHeader).insertId;
  await replacePhotos(listingId, payload?.photos ?? []);
  await replaceGuidebook(listingId, payload?.guidebook ?? {});
  return Number(listingId);
}

export async function updateListing(id: number, payload: any): Promise<boolean> {
  const details = payload?.details ?? {};
  const address = details?.address ?? {};
  const amenities = payload?.amenities ?? {};
  const conditions = payload?.conditions ?? {};
  const finalInfo = payload?.final ?? {};
  const updated = await sqlExecute(
    `UPDATE property_listings SET
      property_name = ?, property_type = ?, property_size = ?, bedrooms = ?, bathrooms = ?,
      street = ?, city = ?, state = ?, zip_code = ?, landmark = ?, latitude = ?, longitude = ?,
      has_bed = ?, has_almirah = ?, has_study_table = ?, has_fan_light = ?, has_ro_water = ?, has_inverter = ?, has_cooling = ?, has_geyser = ?, has_wifi = ?, has_parking = ?, has_cctv = ?, has_washing_machine = ?, has_kitchen = ?,
      couple_friendly = ?, for_boys = ?, for_girls = ?, water24x7 = ?, veg_only = ?, family_friendly = ?, students_only = ?, working_professionals = ?,
      rent_amount = ?, description = ?, temp_contact_no = ?, zone = ?
     WHERE id = ?`,
    [
      details?.propertyName ?? null,
      details?.propertyType ?? null,
      details?.propertySize ?? null,
      details?.bedrooms ?? null,
      details?.bathrooms ?? null,
      address?.street ?? null,
      address?.city ?? null,
      address?.state ?? null,
      address?.zipCode ?? address?.zip ?? null,
      address?.landmark ?? null,
      address?.latitude ?? null,
      address?.longitude ?? null,
      bool(amenities?.hasBed ?? amenities?.bed),
      bool(amenities?.hasAlmirah),
      bool(amenities?.hasStudyTable),
      bool(amenities?.hasFanLight),
      bool(amenities?.hasRoWater),
      bool(amenities?.hasInverter),
      bool(amenities?.hasCooling),
      bool(amenities?.hasGeyser),
      bool(amenities?.hasWifi ?? amenities?.wifi),
      bool(amenities?.hasParking ?? amenities?.parking),
      bool(amenities?.hasCctv),
      bool(amenities?.hasWashingMachine),
      bool(amenities?.hasKitchen),
      bool(conditions?.coupleFriendly),
      bool(conditions?.forBoys),
      bool(conditions?.forGirls),
      bool(conditions?.water24x7),
      bool(conditions?.vegOnly),
      bool(conditions?.familyFriendly),
      bool(conditions?.studentsOnly),
      bool(conditions?.workingProfessionals),
      finalInfo?.rentAmount ?? payload?.rentAmount ?? null,
      finalInfo?.description ?? payload?.description ?? null,
      finalInfo?.contactNo ?? payload?.contactNo ?? null,
      address?.zone ?? payload?.zone ?? null,
      id,
    ]
  );
  if (updated.affectedRows <= 0) return false;
  if (Array.isArray(payload?.photos)) {
    await replacePhotos(id, payload.photos);
  }
  if (payload?.guidebook) {
    await replaceGuidebook(id, payload.guidebook);
  }
  return true;
}

async function replacePhotos(listingId: number, photoUrls: string[]): Promise<void> {
  await sqlExecute(`DELETE FROM property_photos WHERE listing_id = ?`, [listingId]);
  for (const photoUrl of photoUrls) {
    await sqlExecute(`INSERT INTO property_photos (listing_id, photo_url) VALUES (?, ?)`, [
      listingId,
      photoUrl,
    ]);
  }
}

async function replaceGuidebook(listingId: number, guidebook: any): Promise<void> {
  await sqlExecute(`DELETE FROM guidebook_rules WHERE guidebook_id IN (SELECT id FROM listing_guidebook WHERE listing_id = ?)`, [listingId]);
  await sqlExecute(`DELETE FROM guidebook_nearby WHERE guidebook_id IN (SELECT id FROM listing_guidebook WHERE listing_id = ?)`, [listingId]);
  await sqlExecute(`DELETE FROM listing_guidebook WHERE listing_id = ?`, [listingId]);
  if (!guidebook) return;

  const gbResult = await sqlExecute(
    `INSERT INTO listing_guidebook (listing_id, custom_rules) VALUES (?, ?)`,
    [listingId, guidebook.customRules ?? null]
  );
  const guidebookId = (gbResult as ResultSetHeader).insertId;

  const rules = Array.isArray(guidebook.rules) ? guidebook.rules : [];
  for (const rule of rules) {
    const text = typeof rule === 'string' ? rule : rule?.ruleText;
    if (!text) continue;
    await sqlExecute(`INSERT INTO guidebook_rules (guidebook_id, rule_text) VALUES (?, ?)`, [
      guidebookId,
      text,
    ]);
  }

  const nearby = Array.isArray(guidebook.nearbyPlaces) ? guidebook.nearbyPlaces : [];
  for (const place of nearby) {
    await sqlExecute(
      `INSERT INTO guidebook_nearby (guidebook_id, place_name, distance, place_type) VALUES (?, ?, ?, ?)`,
      [guidebookId, place?.name ?? null, place?.distance ?? null, place?.type ?? null]
    );
  }
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function boolish(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

/** Map MySQL snake_case rows to Java-compatible camelCase listing objects. */
function mapListingRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    ownerId: row.owner_id ?? row.ownerId,
    propertyName: row.property_name ?? row.propertyName,
    propertyType: row.property_type ?? row.propertyType,
    propertySize: num(row.property_size ?? row.propertySize),
    bedrooms: row.bedrooms,
    bathrooms: num(row.bathrooms),
    street: row.street,
    city: row.city,
    state: row.state,
    zipCode: row.zip_code ?? row.zipCode,
    landmark: row.landmark,
    latitude: row.latitude,
    longitude: row.longitude,
    hasBed: boolish(row.has_bed ?? row.hasBed),
    hasAlmirah: boolish(row.has_almirah ?? row.hasAlmirah),
    hasStudyTable: boolish(row.has_study_table ?? row.hasStudyTable),
    hasFanLight: boolish(row.has_fan_light ?? row.hasFanLight),
    hasRoWater: boolish(row.has_ro_water ?? row.hasRoWater),
    hasInverter: boolish(row.has_inverter ?? row.hasInverter),
    hasCooling: boolish(row.has_cooling ?? row.hasCooling),
    hasGeyser: boolish(row.has_geyser ?? row.hasGeyser),
    hasWifi: boolish(row.has_wifi ?? row.hasWifi),
    hasParking: boolish(row.has_parking ?? row.hasParking),
    hasCctv: boolish(row.has_cctv ?? row.hasCctv),
    hasWashingMachine: boolish(row.has_washing_machine ?? row.hasWashingMachine),
    hasKitchen: boolish(row.has_kitchen ?? row.hasKitchen),
    coupleFriendly: boolish(row.couple_friendly ?? row.coupleFriendly),
    forBoys: boolish(row.for_boys ?? row.forBoys),
    forGirls: boolish(row.for_girls ?? row.forGirls),
    water24x7: boolish(row.water24x7 ?? row.water_24x7),
    vegOnly: boolish(row.veg_only ?? row.vegOnly),
    familyFriendly: boolish(row.family_friendly ?? row.familyFriendly),
    studentsOnly: boolish(row.students_only ?? row.studentsOnly),
    workingProfessionals: boolish(row.working_professionals ?? row.workingProfessionals),
    avgRating: row.avg_rating ?? row.avgRating,
    reviewCount: row.review_count ?? row.reviewCount,
    rentAmount: num(row.rent_amount ?? row.rentAmount),
    description: row.description,
    createdOn: row.created_on ?? row.createdOn,
    isRented: row.is_rented ?? row.isRented,
    isFeatured: row.is_featured ?? row.isFeatured,
    featuredPriority: row.featured_priority ?? row.featuredPriority,
    tempContactNo: row.temp_contact_no ?? row.tempContactNo,
    zone: row.zone,
  };
}

async function hydrateListings(listings: any[]): Promise<any[]> {
  if (!listings.length) return [];
  const ids = listings.map((l) => Number(l.id)).filter(Boolean);
  if (!ids.length) return [];

  const marks = ids.map(() => '?').join(',');
  const photos = await sqlQuery<any>(
    `SELECT id, listing_id as listingId, photo_url as photoUrl FROM property_photos WHERE listing_id IN (${marks})`,
    ids
  );
  const guidebooks = await sqlQuery<any>(
    `SELECT id, listing_id as listingId, custom_rules as customRules FROM listing_guidebook WHERE listing_id IN (${marks})`,
    ids
  );
  const gbIds = guidebooks.map((g) => g.id);
  let rules: any[] = [];
  let nearby: any[] = [];
  if (gbIds.length) {
    const gm = gbIds.map(() => '?').join(',');
    rules = await sqlQuery<any>(
      `SELECT id, guidebook_id as guidebookId, rule_text as ruleText FROM guidebook_rules WHERE guidebook_id IN (${gm})`,
      gbIds
    );
    nearby = await sqlQuery<any>(
      `SELECT id, guidebook_id as guidebookId, place_name as name, distance, place_type as type FROM guidebook_nearby WHERE guidebook_id IN (${gm})`,
      gbIds
    );
  }

  const photosByListing = new Map<number, any[]>();
  for (const p of photos) {
    const key = Number(p.listingId);
    const arr = photosByListing.get(key) ?? [];
    arr.push({ id: p.id, photoUrl: p.photoUrl });
    photosByListing.set(key, arr);
  }

  const guidebookByListing = new Map<number, any>();
  for (const gb of guidebooks) {
    guidebookByListing.set(Number(gb.listingId), {
      id: gb.id,
      customRules: gb.customRules,
      rules: rules.filter((r) => Number(r.guidebookId) === Number(gb.id)),
      nearbyPlaces: nearby.filter((n) => Number(n.guidebookId) === Number(gb.id)),
    });
  }

  return listings.map((row) => ({
    ...mapListingRow(row),
    photos: photosByListing.get(Number(row.id)) ?? [],
    guidebook: guidebookByListing.get(Number(row.id)) ?? null,
  }));
}

function bool(value: unknown): boolean {
  return boolish(value);
}
