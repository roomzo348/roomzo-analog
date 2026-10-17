import { defineEventHandler, createError, getRouterParam } from 'h3';
import { approveQueuedListing } from '../../../../../services/listing-admin-actions';
import { apiResponse } from '../../../../../utils/api-response';
import { requireAdmin } from '../../../../../utils/admin';

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);
  const listingId = Number(getRouterParam(event, 'listingId'));
  if (!Number.isFinite(listingId) || listingId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid listing' });
  }
  const data = await approveQueuedListing(listingId);
  return apiResponse(1, 'Listing approved', { ...data, adminId: admin.id });
});
