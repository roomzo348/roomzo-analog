import { createError } from 'h3';
import type { ApiResponse, ApiStatus, PaginationMeta } from '../types/api';

export function apiResponse<T>(
  status: ApiStatus,
  message: string,
  data?: T | null
): ApiResponse<T> {
  return { status, message, data: data ?? null };
}

export function apiListResponse<T>(
  listings: T[],
  meta: PaginationMeta,
  message = 'Data fetched successfully'
): Record<string, unknown> {
  return {
    status: 1,
    message,
    listings,
    currentPage: meta.currentPage,
    totalPages: meta.totalPages,
    totalItems: meta.totalItems,
  };
}

export function badRequest(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message });
}

export function unauthorized(message = 'Unauthorized'): never {
  throw createError({ statusCode: 401, statusMessage: message });
}

export function notFound(message = 'Not found'): never {
  throw createError({ statusCode: 404, statusMessage: message });
}
