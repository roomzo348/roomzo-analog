import { describe, expect, it } from 'vitest';
import { planDisplayName, sanitizeBillingReturnUrl, withPaymentStatus } from './billing-return';

describe('sanitizeBillingReturnUrl', () => {
  it('keeps relative listing and profile paths', () => {
    expect(sanitizeBillingReturnUrl('/room/42?showContact=true')).toBe('/room/42?showContact=true');
    expect(sanitizeBillingReturnUrl('/profile')).toBe('/profile');
  });

  it('rejects open redirects and auth loops', () => {
    expect(sanitizeBillingReturnUrl('https://evil.example/phish')).toBe('');
    expect(sanitizeBillingReturnUrl('//evil.example')).toBe('');
    expect(sanitizeBillingReturnUrl('/owner-auth?returnUrl=/pricing')).toBe('');
  });

  it('rejects absolute URLs', () => {
    expect(sanitizeBillingReturnUrl('https://www.roomzo.in/explore-listing')).toBe('');
  });
});

describe('withPaymentStatus', () => {
  it('appends payment status without dropping existing query params', () => {
    expect(withPaymentStatus('/room/9?showContact=true', 'success')).toBe(
      '/room/9?showContact=true&payment=success'
    );
    expect(withPaymentStatus('/profile', 'failed')).toBe('/profile?payment=failed');
  });
});

describe('planDisplayName', () => {
  it('maps known plan codes', () => {
    expect(planDisplayName('starter')).toBe('Starter');
    expect(planDisplayName('PLUS')).toBe('Plus');
    expect(planDisplayName('pro')).toBe('Pro');
  });
});
