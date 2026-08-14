import { getQuery, type H3Event } from 'h3';
import { badRequest } from './api-response';

export function queryInt(
  event: H3Event,
  key: string,
  fallback?: number
): number | undefined {
  const value = getQuery(event)[key];
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    badRequest(`Invalid query parameter: ${key}`);
  }
  return parsed;
}

export function queryStr(
  event: H3Event,
  key: string,
  fallback?: string
): string | undefined {
  const value = getQuery(event)[key];
  if (value == null || value === '') return fallback;
  return String(value);
}
