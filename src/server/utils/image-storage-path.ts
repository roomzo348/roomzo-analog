import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Disk path (outside public_html):
 *   /home/.../domains/roomzo.in/storage/images/jkk.jpg
 *
 * Public URL (via public_html/images → storage/images symlink):
 *   https://roomzo.in/images/jkk.jpg
 *
 * DB must store the public URL only — never storage/... and never base64.
 */
export const DEFAULT_IMAGE_STORAGE =
  '/home/u193538221/domains/roomzo.in/storage/images';

export const PUBLIC_IMAGE_BASE =
  String(process.env['HOSTINGER_UPLOAD_URL'] || process.env['SITE_URL'] || 'https://roomzo.in')
    .replace(/\/+$/, '');

export function getImageStorageDir(): string {
  const fromEnv = String(process.env['IMAGE_STORAGE_PATH'] || '').trim().replace(/[/\\]+$/, '');
  const dir = fromEnv || DEFAULT_IMAGE_STORAGE;

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  return dir;
}

export function imageFilePath(fileName: string): string {
  return join(getImageStorageDir(), fileName);
}

/** Symlink URL stored in DB / returned to the browser. */
export function publicImageUrl(fileName: string): string {
  return `${PUBLIC_IMAGE_BASE}/images/${fileName}`;
}
