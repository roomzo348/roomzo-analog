import { describe, expect, it } from 'vitest';
import {
  hmacSha256Hex,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  isCapturedRazorpayPayment,
  isFailedRazorpayPayment,
  isPaidRazorpayPayment,
} from './razorpay-signature';

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

  it('only treats captured Razorpay payments as successful', () => {
    expect(isCapturedRazorpayPayment('captured')).toBe(true);
    expect(isCapturedRazorpayPayment('authorized')).toBe(false);
    expect(isCapturedRazorpayPayment('failed')).toBe(false);
    expect(isCapturedRazorpayPayment('created')).toBe(false);
  });

  it('credits authorized payments too, since orders auto-capture', () => {
    expect(isPaidRazorpayPayment('captured')).toBe(true);
    expect(isPaidRazorpayPayment('authorized')).toBe(true);
    expect(isPaidRazorpayPayment('created')).toBe(false);
    expect(isPaidRazorpayPayment('failed')).toBe(false);
    expect(isPaidRazorpayPayment(null)).toBe(false);
  });

  it('identifies failed payments for rejection', () => {
    expect(isFailedRazorpayPayment('failed')).toBe(true);
    expect(isFailedRazorpayPayment('FAILED')).toBe(true);
    expect(isFailedRazorpayPayment('captured')).toBe(false);
    expect(isFailedRazorpayPayment(undefined)).toBe(false);
  });
});
