import { defineEventHandler, setResponseStatus } from 'h3';
import { sqlQuery } from '../../db/mysql';
import { apiResponse } from '../../utils/api-response';

/**
 * Public liveness/readiness probe — no auth.
 * GET /api/health
 */
export default defineEventHandler(async (event) => {
  const started = Date.now();
  try {
    await sqlQuery('SELECT 1 AS ok');
    return apiResponse(1, 'ok', {
      ok: true,
      db: 'up',
      latencyMs: Date.now() - started,
      ts: new Date().toISOString(),
    });
  } catch {
    setResponseStatus(event, 503);
    return apiResponse(0, 'degraded', {
      ok: false,
      db: 'down',
      latencyMs: Date.now() - started,
      ts: new Date().toISOString(),
    });
  }
});
