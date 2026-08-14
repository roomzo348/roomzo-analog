import type { H3Event } from 'h3';
import { createError, deleteCookie, getCookie, getHeader, setCookie } from 'h3';
import { getUserById } from '../services/auth-repository';
import { revokeUserSession, validateUserSession } from '../services/session-repository';

export const SESSION_COOKIE = 'roomzo_session';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export async function getAuthUser(event: H3Event): Promise<any | null> {
  const token = getCookie(event, SESSION_COOKIE);
  if (!token) return null;
  const userId = await validateUserSession(token);
  if (!userId) return null;
  return getUserById(userId);
}

export async function requireAuth(event: H3Event): Promise<any> {
  const user = await getAuthUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Login required' });
  }
  return user;
}

export function setSessionCookie(event: H3Event, token: string): void {
  const host = String(getHeader(event, 'host') || '');
  const isLocal = host.includes('localhost') || host.startsWith('127.0.0.1');
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: !isLocal,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE, { path: '/' });
}

export async function revokeSessionFromEvent(event: H3Event): Promise<void> {
  const token = getCookie(event, SESSION_COOKIE);
  if (token) {
    await revokeUserSession(token);
  }
  clearSessionCookie(event);
}

export function getClientIp(event: H3Event): string | undefined {
  const forwarded = getHeader(event, 'x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim();
  return event.node?.req?.socket?.remoteAddress ?? undefined;
}
