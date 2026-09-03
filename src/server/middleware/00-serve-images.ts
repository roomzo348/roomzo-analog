import { createReadStream, existsSync, statSync } from 'node:fs';
import { normalize, extname } from 'node:path';
import { defineEventHandler, getRequestURL, sendStream, setResponseHeader } from 'h3';
import { getImageStorageDir, imageFilePath } from '../utils/image-storage-path';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/** Serve /images/* from storage/images so DB URLs keep working. */
export default defineEventHandler(async (event) => {
  const pathname = decodeURIComponent(getRequestURL(event).pathname || '');
  if (!pathname.startsWith('/images/')) return;

  const fileName = pathname.slice('/images/'.length).replace(/\\/g, '/');
  if (!fileName || fileName.includes('..') || fileName.includes('/')) return;

  const filePath = imageFilePath(fileName);
  // Ensure storage dir exists / is readable; ignore if missing.
  try {
    getImageStorageDir();
  } catch {
    return;
  }

  if (!existsSync(filePath)) return;
  try {
    if (!statSync(filePath).isFile()) return;
  } catch {
    return;
  }

  const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
  setResponseHeader(event, 'Content-Type', type);
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400');
  return sendStream(event, createReadStream(normalize(filePath)));
});
