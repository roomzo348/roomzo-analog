import { defineEventHandler, getMethod, getRouterParam, readBody } from 'h3';
import { getUserProfile, updateUserProfile } from '../../../../services/user-repository';
import { apiResponse } from '../../../../utils/api-response';
import { requireAuth } from '../../../../utils/auth-session';

export default defineEventHandler(async (event) => {
  const userId = Number(getRouterParam(event, 'id'));
  const method = getMethod(event).toUpperCase();
  const authUser = await requireAuth(event);

  if (Number(authUser.id) !== userId) {
    return apiResponse(0, 'Forbidden', null);
  }

  if (method === 'GET') {
    const data = await getUserProfile(userId);
    return apiResponse(data ? 1 : 0, data ? 'Profile fetched successfully' : 'User not found', data);
  }

  if (method === 'PUT') {
    const body = await readBody(event);
    const ok = await updateUserProfile(userId, body);
    const data = ok ? await getUserProfile(userId) : null;
    return apiResponse(ok ? 1 : 0, ok ? 'Profile updated successfully' : 'User not found', data);
  }

  return apiResponse(0, 'Method not allowed');
});
