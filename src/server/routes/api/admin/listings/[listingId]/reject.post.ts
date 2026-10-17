import { defineEventHandler, createError, getRouterParam, readBody } from 'h3';
import { rejectQueuedListing } from '../../../../../services/listing-admin-actions';
import { apiResponse } from '../../../../../utils/api-response';
import { requireAdmin } from '../../../../../utils/admin';

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const listingId = Number(getRouterParam(event, 'listingId'));
  if (!Number.isFinite(listingId) || listingId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid listing' });
  }
  const body = await readBody(event).catch(() => ({}));
  const data = await rejectQueuedListing(listingId, String(body?.reason || 'not_legit'));
  return apiResponse(1, 'Listing rejected', data);
});
