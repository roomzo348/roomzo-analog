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
        planActive: false,
      })
    ).toEqual({ action: 'allow', reason: 'owner' });
  });

  it('keeps an already unlocked property open after credits run out', () => {
    expect(
      decideUnlock({
        isOwner: false,
        alreadyUnlocked: true,
        freeUnlockUsed: true,
        creditsRemaining: 0,
        planActive: false,
      })
    ).toEqual({ action: 'allow', reason: 'already_unlocked' });
  });

  it('gives every user one free owner contact', () => {
    expect(
      decideUnlock({
        isOwner: false,
        alreadyUnlocked: false,
        freeUnlockUsed: false,
        creditsRemaining: 0,
        planActive: false,
      })
    ).toEqual({ action: 'allow', reason: 'free' });
  });

  it('spends a plan credit after the free contact is used', () => {
    expect(
      decideUnlock({
        isOwner: false,
        alreadyUnlocked: false,
        freeUnlockUsed: true,
        creditsRemaining: 7,
        planActive: true,
      })
    ).toEqual({ action: 'allow', reason: 'credit' });
  });

  it('requires payment when the free contact and credits are gone', () => {
    expect(
      decideUnlock({
        isOwner: false,
        alreadyUnlocked: false,
        freeUnlockUsed: true,
        creditsRemaining: 0,
        planActive: true,
      })
    ).toEqual({ action: 'paywall' });
  });
});

describe('wallet helpers', () => {
  it('treats expired plans as zero usable credits', () => {
    const expired = new Date(Date.now() - 60_000);
    expect(isPlanActive(expired)).toBe(false);
    expect(
      usableCredits({
        creditsRemaining: 10,
        freeUnlockUsed: true,
        planCode: 'plus',
        planExpiresAt: expired,
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
});
