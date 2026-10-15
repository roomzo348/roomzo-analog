import { defineEventHandler } from 'h3';
import { getListingRewardConfig } from '../../utils/runtime-config';
import { apiResponse } from '../../utils/api-response';

export default defineEventHandler(async () => {
  const config = getListingRewardConfig();
  return apiResponse(1, 'ok', config);
});
