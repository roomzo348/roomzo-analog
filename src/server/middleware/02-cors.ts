import { appendHeader, defineEventHandler, getHeader, setResponseStatus } from 'h3';

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'https://roomzo.in',
  'https://www.roomzo.in',
]);

function resolveAllowOrigin(origin?: string): string {
  if (origin && allowedOrigins.has(origin)) return origin;
  return 'https://www.roomzo.in';
}

export default defineEventHandler((event) => {
  const origin = getHeader(event, 'origin');
  const allowOrigin = resolveAllowOrigin(origin);

  appendHeader(event, 'Access-Control-Allow-Origin', allowOrigin);
  appendHeader(event, 'Access-Control-Allow-Credentials', 'true');
  appendHeader(event, 'Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  appendHeader(
    event,
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-User-Id'
  );

  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204);
    return '';
  }

  return undefined;
});
