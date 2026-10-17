import {
  defineEventHandler,
  createError,
  getMethod,
  getQuery,
  getRouterParam,
  readBody,
} from 'h3';
import type { H3Event } from 'h3';
import { getAdminListingById, listModerationQueue } from '../../../../services/listing-repository';
import {
  approveQueuedListing,
  rejectQueuedListing,
} from '../../../../services/listing-admin-actions';
import { apiResponse } from '../../../../utils/api-response';
import { requireAdmin } from '../../../../utils/admin';

function adminListingSegments(event: H3Event): string[] {
  const fromParam = getRouterParam(event, 'path');
  if (Array.isArray(fromParam)) {
    return fromParam.map(String).filter(Boolean);
  }
  if (fromParam) {
    return String(fromParam).split('/').filter(Boolean);
  }
  const url = String(event.path || event.node?.req?.url || '').split('?')[0];
  const marker = '/api/admin/listings/';
  const idx = url.indexOf(marker);
  if (idx >= 0) {
    return url.slice(idx + marker.length).split('/').filter(Boolean);
  }
  return [];
}

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event);
    const method = getMethod(event).toUpperCase();
    const segments = adminListingSegments(event);
    const query = getQuery(event);

    if (segments.length === 0 && method === 'GET') {
      const status = String(query.status || 'pending');
      const listings = await listModerationQueue(status);
      return apiResponse(1, 'ok', listings);
    }

    if (segments.length === 1 && method === 'GET') {
      const listingId = Number(segments[0]);
      if (!Number.isFinite(listingId) || listingId <= 0) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid listing' });
      }
      const listing = await getAdminListingById(listingId);
      if (!listing) {
        throw createError({ statusCode: 404, statusMessage: 'Listing not found' });
      }
      return apiResponse(1, 'ok', listing);
    }

    if (segments.length === 2 && method === 'POST' && segments[1] === 'approve') {
      const listingId = Number(segments[0]);
      if (!Number.isFinite(listingId) || listingId <= 0) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid listing' });
      }
      const data = await approveQueuedListing(listingId);
      return apiResponse(1, 'Listing approved', { ...data, adminId: admin.id });
    }

    if (segments.length === 2 && method === 'POST' && segments[1] === 'reject') {
      const listingId = Number(segments[0]);
      if (!Number.isFinite(listingId) || listingId <= 0) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid listing' });
      }
      const body = await readBody(event).catch(() => ({}));
      const data = await rejectQueuedListing(listingId, String(body?.reason || 'not_legit'));
      return apiResponse(1, 'Listing rejected', data);
    }

    return apiResponse(0, 'Endpoint not implemented');
  } catch (error: any) {
    if (error?.statusCode === 401 || error?.statusCode === 403 || error?.statusCode === 404) {
      throw error;
    }
    console.error('[admin listings]', error);
    return apiResponse(-1, error?.statusMessage || error?.message || 'Admin listings failed');
  }
});
