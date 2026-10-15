import type { H3Event } from 'h3';
import { createError } from 'h3';
import { getServerRuntime } from './runtime-config';
import { requireAuth } from './auth-session';

export function isAdminUser(user: { id?: number; email?: string } | null | undefined): boolean {
  if (!user) return false;
  const cfg = getServerRuntime();
  const emails = cfg.adminEmails
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const ids = cfg.adminUserIds
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (ids.includes(Number(user.id))) return true;
  const email = String(user.email || '').trim().toLowerCase();
  return Boolean(email && emails.includes(email));
}

export async function requireAdmin(event: H3Event): Promise<any> {
  const user = await requireAuth(event);
  if (!isAdminUser(user)) {
    throw createError({ statusCode: 403, statusMessage: 'Admin only' });
  }
  return user;
}
