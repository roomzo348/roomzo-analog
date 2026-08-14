import { defineEventHandler, getRouterParam } from 'h3';
import { getOwnerListings } from '../../../services/listing-repository';
import { apiResponse } from '../../../utils/api-response';
import { requireAuth } from '../../../utils/auth-session';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event);
    const ownerId = Number(getRouterParam(event, 'ownerId'));
    if (!Number.isFinite(ownerId) || ownerId <= 0) {
      return apiResponse(0, 'Invalid owner id', []);
    }
    if (Number(user.id) !== ownerId) {
      return apiResponse(0, 'Forbidden', []);
    }

    const data = await getOwnerListings(ownerId);
    return apiResponse(1, 'Owner listings fetched successfully', data);
  } catch (error: any) {
    if (error?.statusCode === 401 || error?.statusCode === 403) {
      throw error;
    }
    return apiResponse(-1, error?.message || 'Failed to fetch owner listings', []);
  }
});
