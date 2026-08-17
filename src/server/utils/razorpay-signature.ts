import { createHmac, timingSafeEqual } from 'node:crypto';

export function hmacSha256Hex(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const expected = hmacSha256Hex(`${input.orderId}|${input.paymentId}`, input.keySecret);
  return safeEqualHex(expected, input.signature);
}

export function verifyWebhookSignature(input: {
  rawBody: string;
  signature: string;
  webhookSecret: string;
}): boolean {
  const expected = hmacSha256Hex(input.rawBody, input.webhookSecret);
  return safeEqualHex(expected, input.signature);
}
