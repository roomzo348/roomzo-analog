import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createError, type H3Event, readMultipartFormData } from 'h3';

const UPLOAD_SECRET = process.env['UPLOAD_SECRET_KEY'] || 'vK9#mP2$xL5@jR8&qW3';
const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg']);

function resolveUploadDir(): string {
  const fromEnv = String(process.env['IMAGE_STORAGE_PATH'] || '').trim();
  if (fromEnv) return fromEnv.replace(/[/\\]+$/, '');
  return join(process.cwd(), 'public', 'images');
}

function safeName(original: string): string {
  const base = original.replace(/\\/g, '/').split('/').pop() || 'photo.jpg';
  return base.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || 'photo.jpg';
}

export async function handleImageUpload(event: H3Event): Promise<{ status: number; url?: string; message?: string }> {
  const parts = await readMultipartFormData(event);
  if (!parts?.length) {
    throw createError({ statusCode: 400, statusMessage: 'No file received' });
  }

  const secretPart = parts.find((p) => p.name === 'secret_key');
  const clientKey = String(secretPart?.data?.toString?.() || '').trim();
  if (clientKey !== UPLOAD_SECRET) {
    throw createError({ statusCode: 403, statusMessage: 'Unauthorized' });
  }

  const filePart = parts.find((p) => p.name === 'file' && p.filename);
  if (!filePart?.data) {
    throw createError({ statusCode: 400, statusMessage: 'No file received' });
  }

  const mime = String(filePart.type || '').toLowerCase();
  if (mime && !ALLOWED.has(mime) && !mime.startsWith('image/')) {
    throw createError({ statusCode: 400, statusMessage: 'Only image files are allowed' });
  }

  if (filePart.data.length > MAX_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'Image is too large (max 12MB)' });
  }

  const dir = resolveUploadDir();
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const fileName = `${Date.now().toString(16)}_${safeName(filePart.filename || 'photo.jpg')}`;
  await writeFile(join(dir, fileName), filePart.data);

  return {
    status: 1,
    url: `/images/${fileName}`,
  };
}
