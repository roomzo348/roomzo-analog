/**
 * Hostinger serves a branded "Page not found" when a URL has no file.
 * Copy SPA fallback files into the Analog public output after build.
 */
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const pub = resolve('dist/analog/public');
const index = resolve(pub, 'index.html');

if (!existsSync(index)) {
  console.warn('[hostinger] dist/analog/public/index.html not found; skip SPA fallback');
  process.exit(0);
}

copyFileSync(index, resolve(pub, '404.html'));
console.log('[hostinger] copied index.html → 404.html');

const htaccessSrc = resolve('public/.htaccess');
if (existsSync(htaccessSrc)) {
  copyFileSync(htaccessSrc, resolve(pub, '.htaccess'));
  console.log('[hostinger] copied public/.htaccess');
}
