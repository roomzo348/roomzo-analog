import { defineEventHandler, getQuery } from 'h3';
import { listModerationQueue } from '../../../services/listing-repository';
import { apiResponse } from '../../../utils/api-response';
import { requireAdmin } from '../../../utils/admin';

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const query = getQuery(event);
  const status = String(query.status || 'pending');
  const listings = await listModerationQueue(status);
  return apiResponse(1, 'ok', listings);
});
