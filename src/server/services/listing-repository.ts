import type { ResultSetHeader } from 'mysql2';
import { sqlExecute, sqlQuery } from '../db/mysql';
import { getServerRuntime } from '../utils/runtime-config';

let listingSchemaReady = false;

const MODERATION_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'has_kitchen', ddl: 'has_kitchen TINYINT(1) NOT NULL DEFAULT 0' },
  { name: 'electricity_included', ddl: 'electricity_included TINYINT(1) NOT NULL DEFAULT 0' },
  { name: 'moderation_status', ddl: 'moderation_status VARCHAR(16) NULL' },
  { name: 'moderation_reason', ddl: 'moderation_reason VARCHAR(64) NULL' },
  { name: 'reward_credited_at', ddl: 'reward_credited_at DATETIME NULL' },
  { name: 'duplicate_of_listing_id', ddl: 'duplicate_of_listing_id INT NULL' },
  { name: 'duplicate_flag', ddl: 'duplicate_flag VARCHAR(32) NULL' },
  { name: 'listing_intent', ddl: 'listing_intent VARCHAR(16) NULL' },
];

const LISTING_INDEXES: Array<{ name: string; ddl: string }> = [
  { name: 'idx_listings_temp_contact', ddl: 'INDEX idx_listings_temp_contact (temp_contact_no)' },
  { name: 'idx_listings_city_zip', ddl: 'INDEX idx_listings_city_zip (city, zip_code)' },
  { name: 'idx_listings_lat_lng', ddl: 'INDEX idx_listings_lat_lng (latitude, longitude)' },
  { name: 'idx_listings_moderation', ddl: 'INDEX idx_listings_moderation (moderation_status)' },
];

export const PUBLIC_MODERATION_SQL =
  `(moderation_status IS NULL OR moderation_status = 'approved')`;
export const PUBLIC_MODERATION_SQL_P =
  `(p.moderation_status IS NULL OR p.moderation_status = 'approved')`;

export function isListingApproved(listing: any): boolean {
  const status = listing?.moderationStatus ?? listing?.moderation_status;
  return status == null || status === '' || status === 'approved';
}

/** Ensure optional listing columns exist (safe to call repeatedly). */
export async function ensureListingSchema(): Promise<void> {
  if (listingSchemaReady) return;
  const rows = await sqlQuery<{ COLUMN_NAME: string }>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'property_listings'
       AND COLUMN_NAME IN (${MODERATION_COLUMNS.map(() => '?').join(',')})`,
    MODERATION_COLUMNS.map((c) => c.name)
  );
  const existing = new Set(rows.map((r) => r.COLUMN_NAME));
  for (const col of MODERATION_COLUMNS) {
    if (!existing.has(col.name)) {
      await sqlExecute(`ALTER TABLE property_listings ADD COLUMN ${col.ddl}`);
    }
  }

  const indexRows = await sqlQuery<{ INDEX_NAME: string }>(
    `SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'property_listings'
       AND INDEX_NAME IN (${LISTING_INDEXES.map(() => '?').join(',')})`,
    LISTING_INDEXES.map((i) => i.name)
  );
  const existingIndexes = new Set(indexRows.map((r) => r.INDEX_NAME));
  for (const idx of LISTING_INDEXES) {
    if (!existingIndexes.has(idx.name)) {
      try {
        await sqlExecute(`ALTER TABLE property_listings ADD ${idx.ddl}`);
      } catch {
        // Index may already exist under another name.
      }
    }
  }

  await sqlExecute(
    `CREATE TABLE IF NOT EXISTS listing_reward_credits (
      listing_id INT NOT NULL PRIMARY KEY,
      user_id INT NOT NULL,
      credits INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_listing_reward_user (user_id)
    )`
  );
  listingSchemaReady = true;
}

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
  await ensureListingSchema();
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
  await ensureListingSchema();
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
  const where: string[] = [
    `(p.is_rented IS NULL OR p.is_rented <> 2)`,
    PUBLIC_MODERATION_SQL_P,
  ];
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
    where.push(`LOWER(TRIM(p.property_type)) = LOWER(TRIM(?))`);
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
    // Match exact zone/landmark or partial (typed landmarks, street mentions).
    where.push(`(
      LOWER(COALESCE(p.zone, '')) = LOWER(?)
      OR LOWER(COALESCE(p.landmark, '')) = LOWER(?)
      OR LOWER(COALESCE(p.zone, '')) LIKE CONCAT('%', LOWER(?), '%')
      OR LOWER(COALESCE(p.landmark, '')) LIKE CONCAT('%', LOWER(?), '%')
      OR LOWER(COALESCE(p.street, '')) LIKE CONCAT('%', LOWER(?), '%')
    )`);
    values.push(filters.zone, filters.zone, filters.zone, filters.zone, filters.zone);
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
  await ensureListingSchema();
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
    } else if (sort === 'price_low' || sort === 'price-low' || sort === 'price_asc') {
      orderBy = 'p.rent_amount ASC, p.created_on DESC';
    } else if (sort === 'price_high' || sort === 'price-high' || sort === 'price_desc') {
      orderBy = 'p.rent_amount DESC, p.created_on DESC';
    } else {
      orderBy = 'p.created_on DESC';
    }
  } else if (sort === 'oldest') {
    orderBy = 'p.created_on ASC';
  } else if (sort === 'price_low' || sort === 'price-low' || sort === 'price_asc') {
    orderBy = 'p.rent_amount ASC, p.created_on DESC';
  } else if (sort === 'price_high' || sort === 'price-high' || sort === 'price_desc') {
    orderBy = 'p.rent_amount DESC, p.created_on DESC';
  } else {
    orderBy = 'p.created_on DESC';
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
  await ensureListingSchema();
  const rows = await sqlQuery<any>(
    `SELECT * FROM property_listings
     WHERE COALESCE(is_featured, 0) = 1 AND (is_rented IS NULL OR is_rented = 0)
       AND ${PUBLIC_MODERATION_SQL}
     ORDER BY COALESCE(featured_priority, 0) DESC, created_on DESC
     LIMIT ?`,
    [limit]
  );
  return hydrateListings(rows);
}

export async function getRecentListings(limit: number): Promise<any[]> {
  await ensureListingSchema();
  const rows = await sqlQuery<any>(
    `SELECT * FROM property_listings
     WHERE (is_rented IS NULL OR is_rented = 0)
       AND ${PUBLIC_MODERATION_SQL}
     ORDER BY created_on DESC
     LIMIT ?`,
    [limit]
  );
  return hydrateListings(rows);
}

export interface CreateListingOptions {
  moderationStatus?: 'pending' | 'approved';
  duplicateOfListingId?: number | null;
  duplicateFlag?: string | null;
  listingIntent?: 'reward' | 'owner' | 'direct' | null;
}

export async function createListing(
  payload: any,
  options: CreateListingOptions = {}
): Promise<number> {
  await ensureListingSchema();
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
      electricity_included,
      couple_friendly, for_boys, for_girls, water24x7, veg_only, family_friendly, students_only, working_professionals,
      rent_amount, description, is_rented, temp_contact_no, zone,
      moderation_status, moderation_reason, duplicate_of_listing_id, duplicate_flag, listing_intent
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      Number(payload?.ownerId),
      details?.propertyName ?? finalInfo?.name ?? null,
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
      bool(amenities?.hasAlmirah ?? amenities?.almirah),
      bool(amenities?.hasStudyTable ?? amenities?.studyTable),
      bool(amenities?.hasFanLight ?? amenities?.fanLight),
      bool(amenities?.hasRoWater ?? amenities?.roWater),
      bool(amenities?.hasInverter ?? amenities?.inverter),
      bool(amenities?.hasCooling ?? amenities?.cooling),
      bool(amenities?.hasGeyser ?? amenities?.geyser),
      bool(amenities?.hasWifi ?? amenities?.wifi),
      bool(amenities?.hasParking ?? amenities?.parking),
      bool(amenities?.hasCctv ?? amenities?.cctv),
      bool(amenities?.hasWashingMachine ?? amenities?.washingMachine),
      bool(amenities?.hasKitchen ?? amenities?.kitchen ?? details?.hasKitchen),
      bool(finalInfo?.electricityIncluded ?? finalInfo?.electricity_included),
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
      options.moderationStatus ?? 'pending',
      options.duplicateFlag ? 'possible_duplicate' : null,
      options.duplicateOfListingId ?? null,
      options.duplicateFlag ?? null,
      options.listingIntent ?? 'owner',
    ]
  );

  const listingId = (result as ResultSetHeader).insertId;
  await replacePhotos(listingId, payload?.photos ?? []);
  await replaceGuidebook(listingId, payload?.guidebook ?? {});
  return Number(listingId);
}

export async function listModerationQueue(status = 'pending', limit = 80): Promise<any[]> {
  await ensureListingSchema();
  const allowed = new Set(['pending', 'approved', 'rejected']);
  const filter = allowed.has(status) ? status : 'pending';
  const rows = await sqlQuery<any>(
    `SELECT p.*, u.email AS owner_email, u.name AS owner_name, u.phone AS owner_phone
     FROM property_listings p
     LEFT JOIN users u ON u.id = p.owner_id
     WHERE p.moderation_status = ?
     ORDER BY CASE WHEN p.duplicate_flag IS NULL OR p.duplicate_flag = '' THEN 1 ELSE 0 END,
              p.created_on DESC
     LIMIT ?`,
    [filter, limit]
  );
  const listings = await hydrateListings(rows);
  return listings.map((listing, i) => ({
    ...listing,
    ownerEmail: rows[i]?.owner_email ?? null,
    ownerName: rows[i]?.owner_name ?? null,
    ownerPhone: rows[i]?.owner_phone ?? null,
  }));
}

export async function getAdminListingById(id: number): Promise<any | null> {
  await ensureListingSchema();
  const rows = await sqlQuery<any>(
    `SELECT p.*, u.email AS owner_email, u.name AS owner_name, u.phone AS owner_phone
     FROM property_listings p
     LEFT JOIN users u ON u.id = p.owner_id
     WHERE p.id = ?
     LIMIT 1`,
    [id]
  );
  if (!rows[0]) return null;
  const listings = await hydrateListings(rows);
  const listing = listings[0];
  if (!listing) return null;
  return {
    ...listing,
    ownerEmail: rows[0].owner_email ?? null,
    ownerName: rows[0].owner_name ?? null,
    ownerPhone: rows[0].owner_phone ?? listing.tempContactNo ?? null,
  };
}

export async function setListingModeration(
  id: number,
  status: 'approved' | 'rejected',
  reason?: string | null
): Promise<boolean> {
  await ensureListingSchema();
  const result = await sqlExecute(
    status === 'approved'
      ? `UPDATE property_listings
         SET moderation_status = 'approved',
             moderation_reason = NULL,
             is_rented = 0,
             duplicate_flag = NULL
         WHERE id = ?`
      : `UPDATE property_listings
         SET moderation_status = 'rejected',
             moderation_reason = ?,
             is_rented = 2
         WHERE id = ?`,
    status === 'approved' ? [id] : [reason ?? null, id]
  );
  return Number(result.affectedRows) > 0;
}

export async function updateListing(id: number, payload: any): Promise<boolean> {
  await ensureListingSchema();
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
      electricity_included = ?,
      couple_friendly = ?, for_boys = ?, for_girls = ?, water24x7 = ?, veg_only = ?, family_friendly = ?, students_only = ?, working_professionals = ?,
      rent_amount = ?, description = ?, temp_contact_no = ?, zone = ?
     WHERE id = ?`,
    [
      details?.propertyName ?? finalInfo?.name ?? null,
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
      bool(amenities?.hasAlmirah ?? amenities?.almirah),
      bool(amenities?.hasStudyTable ?? amenities?.studyTable),
      bool(amenities?.hasFanLight ?? amenities?.fanLight),
      bool(amenities?.hasRoWater ?? amenities?.roWater),
      bool(amenities?.hasInverter ?? amenities?.inverter),
      bool(amenities?.hasCooling ?? amenities?.cooling),
      bool(amenities?.hasGeyser ?? amenities?.geyser),
      bool(amenities?.hasWifi ?? amenities?.wifi),
      bool(amenities?.hasParking ?? amenities?.parking),
      bool(amenities?.hasCctv ?? amenities?.cctv),
      bool(amenities?.hasWashingMachine ?? amenities?.washingMachine),
      bool(amenities?.hasKitchen ?? amenities?.kitchen ?? details?.hasKitchen),
      bool(finalInfo?.electricityIncluded ?? finalInfo?.electricity_included ?? payload?.electricityIncluded),
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
    electricityIncluded: boolish(row.electricity_included ?? row.electricityIncluded),
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
    moderationStatus: row.moderation_status ?? row.moderationStatus ?? null,
    moderationReason: row.moderation_reason ?? row.moderationReason ?? null,
    rewardCreditedAt: row.reward_credited_at ?? row.rewardCreditedAt ?? null,
    duplicateOfListingId: row.duplicate_of_listing_id ?? row.duplicateOfListingId ?? null,
    duplicateFlag: row.duplicate_flag ?? row.duplicateFlag ?? null,
    listingIntent: row.listing_intent ?? row.listingIntent ?? null,
    isFeatured: row.is_featured ?? row.isFeatured,
    featuredPriority: row.featured_priority ?? row.featuredPriority,
    tempContactNo: row.temp_contact_no ?? row.tempContactNo,
    zone: row.zone,
  };
}

async function hydrateListings(listings: any[]): Promise<any[]> {
  await ensureListingSchema();
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
