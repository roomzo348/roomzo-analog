import { describe, expect, it } from 'vitest';
import { hmacSha256Hex, verifyCheckoutSignature, verifyWebhookSignature } from './razorpay-signature';

describe('razorpay signatures', () => {
  it('accepts a valid checkout signature', () => {
    const orderId = 'order_test123';
    const paymentId = 'pay_test456';
    const keySecret = 'test_secret';
    const signature = hmacSha256Hex(`${orderId}|${paymentId}`, keySecret);
    expect(verifyCheckoutSignature({ orderId, paymentId, signature, keySecret })).toBe(true);
  });

  it('rejects a tampered checkout signature', () => {
    expect(
      verifyCheckoutSignature({
        orderId: 'order_test123',
        paymentId: 'pay_test456',
        signature: 'deadbeef',
        keySecret: 'test_secret',
      })
    ).toBe(false);
  });

  it('accepts a valid webhook signature', () => {
    const rawBody = '{"event":"payment.captured"}';
    const webhookSecret = 'whsec_test';
    const signature = hmacSha256Hex(rawBody, webhookSecret);
    expect(verifyWebhookSignature({ rawBody, signature, webhookSecret })).toBe(true);
  });
});
