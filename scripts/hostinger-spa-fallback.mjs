/**
 * Hostinger 404s /room/:id because Analog does not prerender those URLs.
 * This runs after `ng build` and always creates dist/analog/public/room/
 * (plus per-id files when listing IDs can be discovered).
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

copyFileSync(index, resolve(pub, '404.html'));

const htaccessSrc = resolve('public/.htaccess');
if (existsSync(htaccessSrc)) {
  copyFileSync(htaccessSrc, resolve(pub, '.htaccess'));
}

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
    'ErrorDocument 404 /index.html',
    '',
  ].join('\n')
);

const ids = new Set(await collectListingIds(pub));
for (const id of ids) {
  const dir = join(roomDir, String(id));
  mkdirSync(dir, { recursive: true });
  copyFileSync(index, join(dir, 'index.html'));
}

console.log(`[hostinger] created dist/analog/public/room/ (${ids.size} listing fallbacks)`);

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

async function collectListingIds(publicDir) {
  const ids = new Set();
  for (const id of scanPrerenderedHtml(publicDir)) ids.add(String(id));
  for (const id of await fetchIdsFromMysql()) ids.add(String(id));
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

async function fetchIdsFromMysql() {
  const host = process.env.MYSQL_HOST;
  const user = process.env.MYSQL_USER;
  const database = process.env.MYSQL_DATABASE;
  if (!host || !user || !database) return [];

  try {
    const mysql = await import('mysql2/promise');
    const conn = await mysql.createConnection({
      host,
      port: Number(process.env.MYSQL_PORT || 3306),
      user,
      password: String(process.env.MYSQL_PASSWORD || '').replace(/^["']|["']$/g, ''),
      database,
      connectTimeout: 10000,
    });
    const [rows] = await conn.query(
      'SELECT id FROM property_listings WHERE is_rented IS NULL OR is_rented <> 2'
    );
    await conn.end();
    return (rows || []).map((row) => row.id).filter(Boolean);
  } catch (err) {
    console.warn('[hostinger] MySQL listing id lookup skipped:', err?.message || err);
    return [];
  }
}

async function fetchIdsFromHttp() {
  const bases = [
    process.env.API_URL,
    process.env.VITE_API_URL,
    'https://traditional-jobi-roomzo-free-5e097403.koyeb.app',
  ].filter(Boolean);

  const ids = [];
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
        for (const listing of data.listings || data.data || []) {
          if (listing?.id) ids.push(listing.id);
        }
        if (ids.length) return ids;
      } catch {
        // try next candidate
      }
    }
  }
  return ids;
}
