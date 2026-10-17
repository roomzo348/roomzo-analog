import { defineEventHandler, createError, getRouterParam } from 'h3';
import { getAdminListingById } from '../../../../services/listing-repository';
import { apiResponse } from '../../../../utils/api-response';
import { requireAdmin } from '../../../../utils/admin';

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const listingId = Number(getRouterParam(event, 'listingId'));
  if (!Number.isFinite(listingId) || listingId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid listing' });
  }
  const listing = await getAdminListingById(listingId);
  if (!listing) {
    throw createError({ statusCode: 404, statusMessage: 'Listing not found' });
  }
  return apiResponse(1, 'ok', listing);
});
