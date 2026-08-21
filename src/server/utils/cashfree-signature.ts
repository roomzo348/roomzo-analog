import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Cashfree webhook signature:
 * HMAC-SHA256(timestamp + rawBody, clientSecret) → base64
 * Headers: x-webhook-signature, x-webhook-timestamp
 */
export function verifyCashfreeWebhookSignature(input: {
  rawBody: string;
  signature: string;
  timestamp: string;
  secretKey: string;
}): boolean {
  const { rawBody, signature, timestamp, secretKey } = input;
  if (!rawBody || !signature || !timestamp || !secretKey) return false;
  const expected = createHmac('sha256', secretKey)
    .update(String(timestamp) + String(rawBody))
    .digest('base64');
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(String(signature), 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function isPaidCashfreeOrderStatus(status: string | null | undefined): boolean {
  return String(status || '').toUpperCase() === 'PAID';
}

export function isFailedCashfreePaymentStatus(status: string | null | undefined): boolean {
  const value = String(status || '').toUpperCase();
  return value === 'FAILED' || value === 'USER_DROPPED' || value === 'CANCELLED';
}
