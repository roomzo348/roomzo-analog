import { writeFile } from 'node:fs/promises';
import { createError, type H3Event, readMultipartFormData } from 'h3';
import { getImageStorageDir, imageFilePath, publicImageUrl } from './image-storage-path';

const FALLBACK_UPLOAD_SECRET = 'vK9#mP2$xL5@jR8&qW3';
const MAX_BYTES = 12 * 1024 * 1024;

function allowedUploadSecrets(): string[] {
  const fromEnv =
    typeof process !== 'undefined' ? String(process.env['UPLOAD_SECRET_KEY'] || '').trim() : '';
  return [fromEnv, FALLBACK_UPLOAD_SECRET].filter(Boolean);
}

function safeName(original: string): string {
  const base = original.replace(/\\/g, '/').split('/').pop() || 'photo.jpg';
  return base.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || 'photo.jpg';
}

export async function handleImageUpload(
  event: H3Event
): Promise<{ status: number; url?: string; message?: string }> {
  const parts = await readMultipartFormData(event);
  if (!parts?.length) {
    throw createError({ statusCode: 400, statusMessage: 'No file received' });
  }

  const secretPart = parts.find((p) => p.name === 'secret_key');
  const clientKey = String(secretPart?.data?.toString?.() || '').trim();
  if (!allowedUploadSecrets().includes(clientKey)) {
    throw createError({ statusCode: 403, statusMessage: 'Unauthorized' });
  }

  const filePart = parts.find((p) => p.name === 'file' && p.filename);
  if (!filePart?.data) {
    throw createError({ statusCode: 400, statusMessage: 'No file received' });
  }

  const mime = String(filePart.type || '').toLowerCase();
  if (mime && !mime.startsWith('image/')) {
    throw createError({ statusCode: 400, statusMessage: 'Only image files are allowed' });
  }

  if (filePart.data.length > MAX_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'Image is too large (max 12MB)' });
  }

  // 1) Write to disk: roomzo.in/storage/images/<file>
  const dir = getImageStorageDir();
  const fileName = `${Date.now().toString(16)}_${safeName(filePart.filename || 'photo.jpg')}`;
  const fullPath = imageFilePath(fileName);

  try {
    await writeFile(fullPath, filePart.data);
  } catch (err: any) {
    console.error('[upload] failed writing to', fullPath, err);
    throw createError({
      statusCode: 500,
      statusMessage: `Cannot write to ${dir}. Set IMAGE_STORAGE_PATH on Hostinger.`,
    });
  }

  // 2) Return symlink URL for DB: https://roomzo.in/images/<file>
  const url = publicImageUrl(fileName);
  console.log('[upload] disk=', fullPath, 'url=', url);

  return {
    status: 1,
    url,
  };
}
