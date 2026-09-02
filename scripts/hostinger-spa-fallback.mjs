/**
 * Hostinger is serving Analog as static files, so Nitro /api routes 404.
 * After `ng build` this script:
 *  - writes SPA fallbacks for /room/:id
 *  - writes static JSON for GET /api/listings/:id from MySQL
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

loadDotEnv();

const pub = resolve('dist/analog/public');
const index = resolve(pub, 'index.html');

if (!existsSync(index)) {
  console.warn('[hostinger] dist/analog/public/index.html not found; skip SPA fallback');
  process.exit(0);
}

const analogRoot = resolve('dist/analog');
writeFileSync(join(analogRoot, 'server.js'), "import './server/index.mjs';\n");

const roomDir = join(pub, 'room');
mkdirSync(roomDir, { recursive: true });
copyFileSync(index, join(roomDir, 'index.html'));
writeFileSync(
  join(roomDir, '.htaccess'),
  [
    'Options -MultiViews',
    'RewriteEngine On',
    'RewriteBase /room/',
    '',
    'RewriteCond %{REQUEST_FILENAME} !-f',
    'RewriteCond %{REQUEST_FILENAME} !-d',
    'RewriteRule ^ /index.html [L]',
    '',
  ].join('\n')
);

const exported = await exportListingJson(pub);
const ids = new Set([
  ...exported,
  ...(await collectListingIds(pub)),
]);

for (const id of ids) {
  const dir = join(roomDir, String(id));
  mkdirSync(dir, { recursive: true });
  copyFileSync(index, join(dir, 'index.html'));
}

console.log(
  `[hostinger] room fallbacks=${ids.size}; static listing JSON=${exported.length}`
);

function loadDotEnv() {
  for (const file of ['.env.production', '.env.local', '.env']) {
    if (!existsSync(file)) continue;
    let text = '';
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null || process.env[key] === '') {
        process.env[key] = value;
      }
    }
  }
}

async function mysqlConn() {
  const host = process.env.MYSQL_HOST;
  const user = process.env.MYSQL_USER;
  const database = process.env.MYSQL_DATABASE;
  if (!host || !user || !database) return null;
  const mysql = await import('mysql2/promise');
  return mysql.createConnection({
    host,
    port: Number(process.env.MYSQL_PORT || 3306),
    user,
    password: String(process.env.MYSQL_PASSWORD || '').replace(/^["']|["']$/g, ''),
    database,
    connectTimeout: 15000,
  });
}

function boolish(value) {
  return value === true || value === 1 || value === '1';
}

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapListingRow(row) {
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
    zone: row.zone,
    contactUnlocked: false,
  };
}

async function exportListingJson(publicDir) {
  const apiDir = join(publicDir, 'api', 'listings');
  mkdirSync(apiDir, { recursive: true });
  writeFileSync(
    join(apiDir, '.htaccess'),
    [
      '<FilesMatch "^[0-9]+(\\.json)?$">',
      '  ForceType application/json',
      '  <IfModule mod_headers.c>',
      '    Header set Content-Type "application/json; charset=utf-8"',
      '  </IfModule>',
      '</FilesMatch>',
      'RewriteEngine On',
      'RewriteBase /api/listings/',
      'RewriteRule ^([0-9]+)/?$ $1.json [L]',
      '',
    ].join('\n')
  );

  let payloads = [];
  try {
    payloads = await loadListingsFromMysql();
  } catch (err) {
    console.warn('[hostinger] MySQL listing export skipped:', err?.message || err);
  }

  if (!payloads.length) {
    payloads = await loadListingsFromHttp();
  }

  for (const item of payloads) {
    const body = JSON.stringify(item.body);
    writeFileSync(join(apiDir, String(item.id)), body);
    writeFileSync(join(apiDir, `${item.id}.json`), body);
  }

  return payloads.map((item) => String(item.id));
}

async function loadListingsFromMysql() {
  const conn = await mysqlConn();
  if (!conn) return [];

  try {
    const [rows] = await conn.query(
      'SELECT * FROM property_listings WHERE is_rented IS NULL OR is_rented <> 2'
    );
    const listings = rows || [];
    if (!listings.length) return [];

    const ids = listings.map((row) => Number(row.id)).filter(Boolean);
    const marks = ids.map(() => '?').join(',');

    const [photos] = await conn.query(
      `SELECT id, listing_id as listingId, photo_url as photoUrl FROM property_photos WHERE listing_id IN (${marks})`,
      ids
    );
    const [guidebooks] = await conn.query(
      `SELECT id, listing_id as listingId, custom_rules as customRules FROM listing_guidebook WHERE listing_id IN (${marks})`,
      ids
    );

    const gbIds = (guidebooks || []).map((g) => g.id);
    let rules = [];
    let nearby = [];
    if (gbIds.length) {
      const gm = gbIds.map(() => '?').join(',');
      const [ruleRows] = await conn.query(
        `SELECT id, guidebook_id as guidebookId, rule_text as ruleText FROM guidebook_rules WHERE guidebook_id IN (${gm})`,
        gbIds
      );
      const [nearRows] = await conn.query(
        `SELECT id, guidebook_id as guidebookId, place_name as name, distance, place_type as type FROM guidebook_nearby WHERE guidebook_id IN (${gm})`,
        gbIds
      );
      rules = ruleRows || [];
      nearby = nearRows || [];
    }

    const ownerIds = [
      ...new Set(listings.map((row) => Number(row.owner_id)).filter(Boolean)),
    ];
    const owners = new Map();
    if (ownerIds.length) {
      const om = ownerIds.map(() => '?').join(',');
      const [userRows] = await conn.query(
        `SELECT id, name, email FROM users WHERE id IN (${om})`,
        ownerIds
      );
      for (const user of userRows || []) {
        const name = user.name && user.name !== user.email ? user.name : null;
        owners.set(Number(user.id), name || 'Property Owner');
      }
    }

    const photosByListing = new Map();
    for (const photo of photos || []) {
      const key = Number(photo.listingId);
      const arr = photosByListing.get(key) ?? [];
      arr.push({ id: photo.id, photoUrl: photo.photoUrl });
      photosByListing.set(key, arr);
    }

    const guidebookByListing = new Map();
    for (const gb of guidebooks || []) {
      guidebookByListing.set(Number(gb.listingId), {
        id: gb.id,
        customRules: gb.customRules,
        rules: rules.filter((r) => Number(r.guidebookId) === Number(gb.id)),
        nearbyPlaces: nearby.filter((n) => Number(n.guidebookId) === Number(gb.id)),
      });
    }

    return listings.map((row) => {
      const data = {
        ...mapListingRow(row),
        photos: photosByListing.get(Number(row.id)) ?? [],
        guidebook: guidebookByListing.get(Number(row.id)) ?? null,
      };
      return {
        id: row.id,
        body: {
          status: 1,
          message: 'Property fetched successfully',
          ownerName: owners.get(Number(row.owner_id)) || 'Property Owner',
          data,
        },
      };
    });
  } finally {
    await conn.end();
  }
}

async function loadListingsFromHttp() {
  const bases = [
    process.env.API_URL,
    process.env.VITE_API_URL,
    'https://traditional-jobi-roomzo-free-5e097403.koyeb.app',
  ].filter(Boolean);

  for (const base of bases) {
    const root = String(base).replace(/\/+$/, '');
    const urls = [
      `${root}/api/listings/all?page=0&size=50`,
      `${root}/listings/all?page=0&size=50`,
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        const listings = data.listings || data.data || [];
        return listings
          .filter((listing) => listing?.id)
          .map((listing) => ({
            id: listing.id,
            body: {
              status: 1,
              message: 'Property fetched successfully',
              ownerName: listing.ownerName || 'Property Owner',
              data: { ...listing, contactUnlocked: false },
            },
          }));
      } catch {
        // try next candidate
      }
    }
  }
  return [];
}

async function collectListingIds(publicDir) {
  const ids = new Set();
  for (const id of scanPrerenderedHtml(publicDir)) ids.add(String(id));
  for (const id of await fetchIdsFromHttp()) ids.add(String(id));
  return ids;
}

function scanPrerenderedHtml(dir) {
  const ids = new Set();
  const walk = (current) => {
    let entries = [];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.html')) continue;
      let html = '';
      try {
        html = readFileSync(full, 'utf8');
      } catch {
        continue;
      }
      for (const match of html.matchAll(/\/room\/(\d+)/g)) ids.add(match[1]);
      for (const match of html.matchAll(/data-card-id="(\d+)"/g)) ids.add(match[1]);
    }
  };
  walk(dir);
  return ids;
}

async function fetchIdsFromHttp() {
  const listings = await loadListingsFromHttp();
  return listings.map((item) => item.id);
}
