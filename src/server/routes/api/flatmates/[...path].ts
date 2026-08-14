import { defineEventHandler, getMethod, getQuery, getRouterParam, readBody } from 'h3';
import {
  createFlatmatePost,
  deleteFlatmatePost,
  getFlatmateMemoryFeed,
  getFlatmateNearby,
  hasActivePost,
} from '../../../services/flatmate-repository';
import { apiResponse } from '../../../utils/api-response';
import { requireAuth } from '../../../utils/auth-session';

export default defineEventHandler(async (event) => {
  const method = getMethod(event).toUpperCase();
  const query = getQuery(event);
  const path = String(getRouterParam(event, 'path') || '');
  const segments = path.split('/').filter(Boolean);

  if ((segments.length === 0 || segments[0] === '') && method === 'GET') {
    const data = await getFlatmateMemoryFeed(100);
    return apiResponse(1, 'Flatmate posts fetched', data);
  }

  if ((segments.length === 0 || segments[0] === '') && method === 'POST') {
    const user = await requireAuth(event);
    const body = await readBody(event);
    const data = await createFlatmatePost(body, Number(user.id));
    return apiResponse(1, 'Flatmate post created successfully', data);
  }

  if (segments[0] === 'memory-feed' && method === 'GET') {
    return apiResponse(1, 'Memory feed fetched', await getFlatmateMemoryFeed(25));
  }

  if (segments[0] === 'nearby' && method === 'GET') {
    const page = Number(query.page ?? 0);
    const size = Number(query.size ?? 10);
    const data = await getFlatmateNearby(page, size);
    return { status: 1, data };
  }

  if (segments[0] === 'check-status' && method === 'GET') {
    const user = await requireAuth(event);
    return { status: 1, data: await hasActivePost(Number(user.id)) };
  }

  if (segments[0] && method === 'DELETE') {
    const user = await requireAuth(event);
    const ok = await deleteFlatmatePost(Number(segments[0]), Number(user.id));
    return apiResponse(ok ? 1 : 0, ok ? 'Flatmate post deleted' : 'Post not found');
  }

  return apiResponse(0, 'Endpoint not implemented');
});
