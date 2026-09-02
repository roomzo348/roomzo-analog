/**
 * CommonJS boot file for Hostinger Passenger / `node app.js`.
 * Copied to dist/analog/app.js after build. Do not use ESM `import` here.
 */
const { existsSync } = require('fs');
const { join } = require('path');
const { pathToFileURL } = require('url');

process.env.HOST = process.env.HOST || '0.0.0.0';
process.env.NITRO_HOST = process.env.NITRO_HOST || process.env.HOST;
if (process.env.PORT) {
  process.env.NITRO_PORT = process.env.NITRO_PORT || process.env.PORT;
}

const candidates = [
  join(__dirname, 'server', 'index.mjs'),
  join(process.cwd(), 'server', 'index.mjs'),
  join(__dirname, 'index.mjs'),
  join(process.cwd(), 'dist', 'analog', 'server', 'index.mjs'),
];

const entry = candidates.find((file) => existsSync(file));
if (!entry) {
  console.error('[roomzo] Analog server not found', {
    cwd: process.cwd(),
    dirname: __dirname,
    candidates,
  });
  process.exit(1);
}

console.log('[roomzo] starting', entry);
import(pathToFileURL(entry).href).catch((err) => {
  console.error('[roomzo] boot failed', err);
  process.exit(1);
});
