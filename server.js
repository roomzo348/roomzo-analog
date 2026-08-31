/**
 * Hostinger Node.js / Passenger entry.
 * Analog/Nitro emits the real server at dist/analog/server/index.mjs after `npm run build`.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const entry = resolve(process.cwd(), 'dist/analog/server/index.mjs');
await import(pathToFileURL(entry).href);
