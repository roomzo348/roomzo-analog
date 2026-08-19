export type UnlockReason = 'owner' | 'already_unlocked' | 'credit';
export type UnlockDecision =
  | { action: 'allow'; reason: UnlockReason }
  | { action: 'paywall' };

export interface WalletSnapshot {
  creditsRemaining: number;
  freeUnlockUsed: boolean;
  planCode: string | null;
  planExpiresAt: Date | null;
}

/**
 * Whether a plan window is still open. Retained for reporting only: contact
 * points do not expire, so this must not gate spending or contact reveals.
 */
export function isPlanActive(planExpiresAt: Date | null | undefined, now = new Date()): boolean {
  if (!planExpiresAt) return false;
  return planExpiresAt.getTime() > now.getTime();
}

/** Purchased points never expire, so every remaining point stays spendable. */
export function usableCredits(wallet: WalletSnapshot): number {
  return Math.max(0, Number(wallet.creditsRemaining || 0));
}

export function decideUnlock(input: {
  isOwner: boolean;
  alreadyUnlocked: boolean;
  freeUnlockUsed: boolean;
  creditsRemaining: number;
}): UnlockDecision {
  if (input.isOwner) return { action: 'allow', reason: 'owner' };
  // Viewing any owner contact always requires at least one credit in the wallet.
  // A listing unlocked before does not cost again, but credits must remain > 0.
  if (input.creditsRemaining <= 0) return { action: 'paywall' };
  if (input.alreadyUnlocked) return { action: 'allow', reason: 'already_unlocked' };
  return { action: 'allow', reason: 'credit' };
}

export function nextPlanExpiry(currentExpiry: Date | null | undefined, durationDays: number, now = new Date()): Date {
  const base = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  return new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000);
}

export function redactListingContact<T extends Record<string, unknown>>(
  listing: T,
  reveal: boolean
): T & { contactUnlocked: boolean } {
  const copy = { ...listing } as T & { contactUnlocked: boolean };
  copy.contactUnlocked = reveal;
  if (reveal) return copy;
  delete (copy as Record<string, unknown>)['contactNo'];
  delete (copy as Record<string, unknown>)['tempContactNo'];
  delete (copy as Record<string, unknown>)['contact_no'];
  delete (copy as Record<string, unknown>)['temp_contact_no'];
  delete (copy as Record<string, unknown>)['email'];
  delete (copy as Record<string, unknown>)['ownerEmail'];
  delete (copy as Record<string, unknown>)['ownerPhone'];
  delete (copy as Record<string, unknown>)['phone'];
  delete (copy as Record<string, unknown>)['whatsapp'];
  delete (copy as Record<string, unknown>)['mobile'];
  return copy;
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `${'•'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}
