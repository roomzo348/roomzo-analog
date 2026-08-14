import { defineEventHandler, getMethod, getRouterParam, readBody } from 'h3';
import { hasSafetyConsent, saveSafetyConsent } from '../../../services/consent-repository';
import { apiResponse } from '../../../utils/api-response';
import { requireAuth } from '../../../utils/auth-session';

export default defineEventHandler(async (event) => {
  const method = getMethod(event).toUpperCase();
  const path = String(getRouterParam(event, 'path') || '');
  const segments = path.split('/').filter(Boolean);

  if (segments[0] === 'save' && method === 'POST') {
    const user = await requireAuth(event);
    const body = await readBody(event);
    await saveSafetyConsent(Number(user.id), Boolean(body?.safetyConsentGiven));
    return apiResponse(1, 'Consent saved successfully');
  }

  if (segments[0] === 'check' && segments[1] && method === 'GET') {
    const user = await requireAuth(event);
    const requestedUserId = Number(segments[1]);
    if (Number(user.id) !== requestedUserId) {
      return apiResponse(0, 'Forbidden', null);
    }
    const hasConsent = await hasSafetyConsent(requestedUserId);
    return { status: 1, hasConsent };
  }

  return apiResponse(0, 'Endpoint not implemented');
});
