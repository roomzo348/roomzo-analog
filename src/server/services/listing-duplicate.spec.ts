import { describe, expect, it } from 'vitest';
import { haversineMeters, normalizeAddressPart, normalizePhone } from './listing-duplicate.util';

describe('listing duplicate helpers', () => {
  it('normalizes Indian phone numbers to last 10 digits', () => {
    expect(normalizePhone('+91 98765-43210')).toBe('9876543210');
    expect(normalizePhone('09876543210')).toBe('9876543210');
  });

  it('normalizes address punctuation and case', () => {
    expect(normalizeAddressPart('Civil Lines,  ')).toBe('civil lines');
  });

  it('treats ~80m as within hard-duplicate distance', () => {
    const meters = haversineMeters(25.4358, 81.8463, 25.4359, 81.8463);
    expect(meters).toBeLessThan(80);
    expect(haversineMeters(25.4358, 81.8463, 25.45, 81.86)).toBeGreaterThan(80);
  });
});
