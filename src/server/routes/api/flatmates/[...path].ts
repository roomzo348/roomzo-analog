import { defineEventHandler, getMethod, getQuery, getRouterParam, readBody } from 'h3';
import {
  createFlatmatePost,
  deleteFlatmatePost,
  getFlatmateMemoryFeed,
  getFlatmateNearby,
  hasActivePost,
} from '../../../services/flatmate-repository';
import {
  addFlatmateFavourite,
  getFlatmateFavouritesByUser,
  removeFlatmateFavourite,
} from '../../../services/flatmate-favourite-repository';
import { apiResponse } from '../../../utils/api-response';
import { requireAuth } from '../../../utils/auth-session';

function toPostId(value: unknown): number | null {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export default defineEventHandler(async (event) => {
  const method = getMethod(event).toUpperCase();
  const query = getQuery(event);
  // Bare /api/flatmates has no "path" param, so this safely becomes ''
  const path = String(getRouterParam(event, 'path') || '');
  const segments = path.split('/').filter(Boolean);
  const isRoot = segments.length === 0;

  // GET /api/flatmates
  if (isRoot && method === 'GET') {
    const data = await getFlatmateMemoryFeed(100);
    return apiResponse(1, 'Flatmate posts fetched', data);
  }

  // POST /api/flatmates
  if (isRoot && method === 'POST') {
    const user = await requireAuth(event);
    const body = await readBody(event);
    const data = await createFlatmatePost(body, Number(user.id));
    return apiResponse(1, 'Flatmate post created successfully', data);
  }

  // GET /api/flatmates/memory-feed
  if (segments[0] === 'memory-feed' && method === 'GET') {
    return apiResponse(1, 'Memory feed fetched', await getFlatmateMemoryFeed(25));
  }

  // GET /api/flatmates/nearby?page=0&size=10
  if (segments[0] === 'nearby' && method === 'GET') {
    const page = Number(query['page'] ?? 0);
    const size = Number(query['size'] ?? 10);
    const data = await getFlatmateNearby(page, size);
    return { status: 1, data };
  }

  // GET /api/flatmates/check-status
  if (segments[0] === 'check-status' && method === 'GET') {
    const user = await requireAuth(event);
    return { status: 1, data: await hasActivePost(Number(user.id)) };
  }

  // POST /api/flatmates/favourites/save
  if (segments[0] === 'favourites' && segments[1] === 'save' && method === 'POST') {
    const user = await requireAuth(event);
    const body = await readBody(event);
    const postId = toPostId(body?.postId ?? body?.flatmatePostId);
    if (!postId) {
      return apiResponse(0, 'A valid flatmate post id is required');
    }
    await addFlatmateFavourite(Number(user.id), postId);
    return apiResponse(1, 'Saved to favourites');
  }

  // DELETE /api/flatmates/favourites/remove  (postId in body, or ?postId=)
  if (segments[0] === 'favourites' && segments[1] === 'remove' && method === 'DELETE') {
    const user = await requireAuth(event);
    // Some clients strip bodies on DELETE, so fall back to the query string
    const body = await readBody(event).catch(() => null);
    const postId = toPostId(body?.postId ?? body?.flatmatePostId ?? query['postId']);
    if (!postId) {
      return apiResponse(0, 'A valid flatmate post id is required');
    }
    const ok = await removeFlatmateFavourite(Number(user.id), postId);
    return apiResponse(ok ? 1 : 0, ok ? 'Removed from favourites' : 'Favourite not found');
  }

  // GET /api/flatmates/favourites
  if (segments[0] === 'favourites' && method === 'GET') {
    const user = await requireAuth(event);
    const data = await getFlatmateFavouritesByUser(Number(user.id));
    return apiResponse(1, 'Favourites fetched successfully', data);
  }

  // DELETE /api/flatmates/:id
  if (segments[0] && method === 'DELETE') {
    const user = await requireAuth(event);
    const postId = toPostId(segments[0]);
    if (!postId) {
      return apiResponse(0, 'A valid flatmate post id is required');
    }
    const ok = await deleteFlatmatePost(postId, Number(user.id));
    return apiResponse(ok ? 1 : 0, ok ? 'Flatmate post deleted' : 'Post not found');
  }

  return apiResponse(0, 'Endpoint not implemented');
});