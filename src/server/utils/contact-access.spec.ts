import { describe, expect, it } from 'vitest';
import {
  decideUnlock,
  isPlanActive,
  nextPlanExpiry,
  redactListingContact,
  usableCredits,
} from './contact-access';

describe('contact unlock rules', () => {
  it('allows the listing owner without spending credits', () => {
    expect(
      decideUnlock({
        isOwner: true,
        alreadyUnlocked: false,
        freeUnlockUsed: true,
        creditsRemaining: 0,
      })
    ).toEqual({ action: 'allow', reason: 'owner' });
  });

  it('keeps a paid unlock available forever, even with no credits left', () => {
    expect(
      decideUnlock({
        isOwner: false,
        alreadyUnlocked: true,
        freeUnlockUsed: true,
        creditsRemaining: 0,
      })
    ).toEqual({ action: 'allow', reason: 'already_unlocked' });
  });

  it('reopens a previously unlocked listing without spending another credit', () => {
    expect(
      decideUnlock({
        isOwner: false,
        alreadyUnlocked: true,
        freeUnlockUsed: true,
        creditsRemaining: 2,
      })
    ).toEqual({ action: 'allow', reason: 'already_unlocked' });
  });

  it('requires a paid credit before the first owner contact', () => {
    expect(
      decideUnlock({
        isOwner: false,
        alreadyUnlocked: false,
        freeUnlockUsed: false,
        creditsRemaining: 0,
      })
    ).toEqual({ action: 'paywall' });
  });

  it('spends a credit to unlock a new property', () => {
    expect(
      decideUnlock({
        isOwner: false,
        alreadyUnlocked: false,
        freeUnlockUsed: true,
        creditsRemaining: 7,
      })
    ).toEqual({ action: 'allow', reason: 'credit' });
  });

  it('requires payment when credits are gone', () => {
    expect(
      decideUnlock({
        isOwner: false,
        alreadyUnlocked: false,
        freeUnlockUsed: true,
        creditsRemaining: 0,
      })
    ).toEqual({ action: 'paywall' });
  });
});

describe('wallet helpers', () => {
  it('keeps credits spendable after the plan window has passed', () => {
    const expired = new Date(Date.now() - 60_000);
    expect(isPlanActive(expired)).toBe(false);
    expect(
      usableCredits({
        creditsRemaining: 10,
        freeUnlockUsed: true,
        planCode: 'plus',
        planExpiresAt: expired,
      })
    ).toBe(10);
  });

  it('never reports a negative balance', () => {
    expect(
      usableCredits({
        creditsRemaining: -3,
        freeUnlockUsed: false,
        planCode: null,
        planExpiresAt: null,
      })
    ).toBe(0);
  });

  it('extends an active plan instead of shortening it', () => {
    const current = new Date('2026-09-01T00:00:00.000Z');
    const now = new Date('2026-08-17T00:00:00.000Z');
    const next = nextPlanExpiry(current, 30, now);
    expect(next.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });
});

describe('listing contact redaction', () => {
  it('strips phone fields until a listing is unlocked', () => {
    const listing = {
      id: 9,
      contactNo: '9999999999',
      tempContactNo: '8888888888',
    };
    const hidden = redactListingContact(listing, false);
    expect(hidden.contactUnlocked).toBe(false);
    expect(hidden.contactNo).toBeUndefined();
    expect(hidden.tempContactNo).toBeUndefined();

    const shown = redactListingContact(listing, true);
    expect(shown.contactUnlocked).toBe(true);
    expect(shown.tempContactNo).toBe('8888888888');
  });

  it('strips email and phone aliases until unlocked', () => {
    const listing = {
      id: 3,
      email: 'owner@example.com',
      phone: '9999999999',
      ownerPhone: '8888888888',
    };
    const hidden = redactListingContact(listing, false);
    expect(hidden.email).toBeUndefined();
    expect(hidden.phone).toBeUndefined();
    expect(hidden.ownerPhone).toBeUndefined();
  });
});
