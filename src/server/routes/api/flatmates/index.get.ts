import { defineEventHandler } from 'h3';
import { getFlatmateMemoryFeed } from '../../../services/flatmate-repository';
import { apiResponse } from '../../../utils/api-response';

export default defineEventHandler(async () => {
  const data = await getFlatmateMemoryFeed(100);
  return apiResponse(1, 'Flatmate posts fetched', data);
});