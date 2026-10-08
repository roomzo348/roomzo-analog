import { defineEventHandler, readBody } from 'h3';
import { createFlatmatePost } from '../../../services/flatmate-repository';
import { apiResponse } from '../../../utils/api-response';
import { requireAuth } from '../../../utils/auth-session';

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const body = await readBody(event);
  const data = await createFlatmatePost(body, Number(user.id));
  return apiResponse(1, 'Flatmate post created successfully', data);
});