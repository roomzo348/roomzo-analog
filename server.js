/**
 * Hostinger Node entry. Analog/Nitro output layout differs by cwd:
 *  - output dir = dist/analog  →  ./server/index.mjs
 *  - repo root / local start   →  ./dist/analog/server/index.mjs
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.HOST ||= '0.0.0.0';
process.env.NITRO_HOST ||= process.env.HOST;
if (process.env.PORT) {
  process.env.NITRO_PORT ||= process.env.PORT;
}

const here = dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();
const candidates = [
  join(here, 'server', 'index.mjs'),
  join(cwd, 'server', 'index.mjs'),
  join(here, 'dist', 'analog', 'server', 'index.mjs'),
  join(cwd, 'dist', 'analog', 'server', 'index.mjs'),
];

const entry = candidates.find((file) => existsSync(file));
if (!entry) {
  console.error('[roomzo] Analog server not found', { cwd, here, candidates });
  process.exit(1);
}

console.log('[roomzo] starting', entry);
await import(pathToFileURL(entry).href);
