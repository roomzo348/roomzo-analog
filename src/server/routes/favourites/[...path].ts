import { defineEventHandler, getMethod, getRouterParam, readBody } from 'h3';
import { addFavourite, getFavouritesByUser, removeFavourite } from '../../services/favourite-repository';
import { apiResponse } from '../../utils/api-response';
import { requireAuth } from '../../utils/auth-session';

export default defineEventHandler(async (event) => {
  const method = getMethod(event).toUpperCase();
  const path = String(getRouterParam(event, 'path') || '');
  const segments = path.split('/').filter(Boolean);

  if (segments[0] === 'save' && method === 'POST') {
    const user = await requireAuth(event);
    const body = await readBody(event);
    await addFavourite(Number(user.id), Number(body?.propertyId));
    return apiResponse(1, 'Saved to favourites');
  }

  if (segments[0] === 'remove' && method === 'DELETE') {
    const user = await requireAuth(event);
    const body = await readBody(event);
    const ok = await removeFavourite(Number(user.id), Number(body?.propertyId));
    return apiResponse(ok ? 1 : 0, ok ? 'Removed from favourites' : 'Favourite not found');
  }

  if (segments[0] === 'user' && segments[1] && method === 'GET') {
    const user = await requireAuth(event);
    const requestedUserId = Number(segments[1]);
    if (Number(user.id) !== requestedUserId) {
      return apiResponse(0, 'Forbidden', []);
    }
    const data = await getFavouritesByUser(requestedUserId);
    return apiResponse(1, 'Favourites fetched successfully', data);
  }

  return apiResponse(0, 'Endpoint not implemented');
});
