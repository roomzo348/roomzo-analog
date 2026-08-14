import { defineEventHandler, getRouterParam } from 'h3';
import { getFavouritesByUser } from '../../../services/favourite-repository';
import { apiResponse } from '../../../utils/api-response';
import { requireAuth } from '../../../utils/auth-session';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event);
    const userId = Number(getRouterParam(event, 'userId'));
    if (!Number.isFinite(userId) || userId <= 0) {
      return apiResponse(0, 'Invalid user id', []);
    }
    if (Number(user.id) !== userId) {
      return apiResponse(0, 'Forbidden', []);
    }

    const data = await getFavouritesByUser(userId);
    return apiResponse(1, 'Favourites fetched successfully', data);
  } catch (error: any) {
    if (error?.statusCode === 401 || error?.statusCode === 403) {
      throw error;
    }
    return apiResponse(-1, error?.message || 'Failed to fetch favourites', []);
  }
});
