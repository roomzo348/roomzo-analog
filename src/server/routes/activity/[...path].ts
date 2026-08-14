import { defineEventHandler, getMethod, getQuery, getRouterParam, readBody } from 'h3';
import {
  logActivity,
  mostByEvent,
  ownerMetrics,
  propertyMetrics,
  recentActivity,
  summary,
  topAreas,
  userActivity,
  userInsights,
} from '../../services/activity-repository';
import { apiResponse } from '../../utils/api-response';

function limitOf(v: unknown, fallback = 10): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default defineEventHandler(async (event) => {
  try {
    const method = getMethod(event).toUpperCase();
    const query = getQuery(event);
    const days = query.days == null ? undefined : Number(query.days);
    const path = String(getRouterParam(event, 'path') || '');
    const segments = path.split('/').filter(Boolean);

    if (segments[0] === 'log' && method === 'POST') {
      const body = await readBody(event);
      await logActivity(body);
      return apiResponse(1, 'Activity logged');
    }

    if (segments[0] === 'analytics' && segments[1] === 'most-viewed' && method === 'GET') {
      return apiResponse(1, 'Most viewed fetched', await mostByEvent('PROPERTY_VIEW', limitOf(query.limit), days));
    }
    if (segments[0] === 'analytics' && segments[1] === 'most-contacted' && method === 'GET') {
      return apiResponse(1, 'Most contacted fetched', await mostByEvent('PROPERTY_CONTACT', limitOf(query.limit), days));
    }
    if (segments[0] === 'analytics' && segments[1] === 'most-shared' && method === 'GET') {
      return apiResponse(1, 'Most shared fetched', await mostByEvent('PROPERTY_SHARE', limitOf(query.limit), days));
    }
    if (segments[0] === 'analytics' && segments[1] === 'top-areas' && method === 'GET') {
      return apiResponse(
        1,
        'Top areas fetched',
        await topAreas(String(query.event || 'SEARCH').trim().toUpperCase(), limitOf(query.limit), days)
      );
    }
    if (segments[0] === 'analytics' && segments[1] === 'summary' && method === 'GET') {
      return apiResponse(1, 'Summary fetched', await summary(days));
    }
    if (segments[0] === 'analytics' && segments[1] === 'recent' && method === 'GET') {
      return apiResponse(
        1,
        'Recent activity fetched',
        await recentActivity(limitOf(query.limit, 50), query.event ? String(query.event) : undefined, days)
      );
    }
    if (segments[0] === 'analytics' && segments[1] === 'owner' && segments[2] && method === 'GET') {
      return apiResponse(1, 'Owner metrics fetched', await ownerMetrics(Number(segments[2]), days));
    }
    if (segments[0] === 'analytics' && segments[1] === 'property' && segments[2] && method === 'GET') {
      return apiResponse(1, 'Property metrics fetched', await propertyMetrics(Number(segments[2]), days));
    }
    if (segments[0] === 'user' && segments[1] && segments[2] === 'insights' && method === 'GET') {
      return apiResponse(
        1,
        'User insights fetched',
        await userInsights(Number(segments[1]), limitOf(query.limit, 5), days)
      );
    }
    if (segments[0] === 'user' && segments[1] && method === 'GET') {
      return apiResponse(
        1,
        'User activity fetched',
        await userActivity(Number(segments[1]), limitOf(query.limit, 20), days)
      );
    }

    return apiResponse(0, 'Endpoint not implemented');
  } catch {
    // Keep ingestion/analytics non-blocking semantics similar to Java controller.
    return apiResponse(-1, 'Failed to process activity request');
  }
});
