import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  isFailedCashfreePaymentStatus,
  isPaidCashfreeOrderStatus,
  verifyCashfreeWebhookSignature,
} from './cashfree-signature';

describe('cashfree webhook signatures', () => {
  it('accepts a valid HMAC over timestamp + raw body', () => {
    const secretKey = 'test_secret';
    const timestamp = '1746427759733';
    const rawBody = '{"type":"PAYMENT_SUCCESS","data":{"order":{"order_id":"ord_1"}}}';
    const signature = createHmac('sha256', secretKey)
      .update(timestamp + rawBody)
      .digest('base64');

    expect(
      verifyCashfreeWebhookSignature({ rawBody, signature, timestamp, secretKey })
    ).toBe(true);
  });

  it('rejects a tampered body', () => {
    const secretKey = 'test_secret';
    const timestamp = '1746427759733';
    const rawBody = '{"type":"PAYMENT_SUCCESS"}';
    const signature = createHmac('sha256', secretKey)
      .update(timestamp + rawBody)
      .digest('base64');

    expect(
      verifyCashfreeWebhookSignature({
        rawBody: '{"type":"PAYMENT_FAILED"}',
        signature,
        timestamp,
        secretKey,
      })
    ).toBe(false);
  });

  it('maps order and payment status helpers', () => {
    expect(isPaidCashfreeOrderStatus('PAID')).toBe(true);
    expect(isPaidCashfreeOrderStatus('ACTIVE')).toBe(false);
    expect(isFailedCashfreePaymentStatus('FAILED')).toBe(true);
    expect(isFailedCashfreePaymentStatus('USER_DROPPED')).toBe(true);
    expect(isFailedCashfreePaymentStatus('SUCCESS')).toBe(false);
  });
});
