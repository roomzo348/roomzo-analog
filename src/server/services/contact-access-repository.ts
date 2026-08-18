import { connExecute, connQuery, sqlQuery, withTransaction } from '../db/mysql';
import { getListingById } from './listing-repository';
import { getOwnerInfo } from './auth-repository';
import {
  ensureBillingTables,
  ensureWallet,
  getWallet,
  serializeWallet,
} from './billing-repository';
import { decideUnlock, isPlanActive, usableCredits } from '../utils/contact-access';

export async function hasUnlockedListing(userId: number, listingId: number): Promise<boolean> {
  await ensureBillingTables();
  const rows = await sqlQuery<{ id: number }>(
    `SELECT id FROM contact_unlocks WHERE user_id = ? AND listing_id = ? LIMIT 1`,
    [userId, listingId]
  );
  return Boolean(rows[0]);
}

export async function getUnlockedListingIds(userId: number): Promise<number[]> {
  await ensureBillingTables();
  const rows = await sqlQuery<{ listing_id: number }>(
    `SELECT listing_id FROM contact_unlocks WHERE user_id = ?`,
    [userId]
  );
  return rows.map((row) => Number(row.listing_id));
}

function listingContact(listing: any, owner: any) {
  const propertyPhone = listing?.tempContactNo || listing?.contactNo || owner?.phone || null;
  return {
    name: owner?.name || 'Property Owner',
    phone: propertyPhone,
    propertyPhone,
    ownerPhone: owner?.phone || null,
    email: owner?.email || null,
  };
}

export async function unlockListingContact(userId: number, listingId: number): Promise<{
  status: 0 | 1;
  code?: string;
  message: string;
  data: Record<string, unknown>;
}> {
  await ensureBillingTables();
  const listing = await getListingById(listingId);
  if (!listing) {
    return { status: 0, code: 'NOT_FOUND', message: 'Listing not found', data: {} };
  }

  const ownerId = Number(listing.ownerId ?? listing.owner_id);
  const owner = ownerId ? await getOwnerInfo(ownerId) : null;
  const contact = listingContact(listing, owner);
  const wallet = await getWallet(userId);
  const serialized = serializeWallet(wallet);

  if (Number(userId) === ownerId) {
    return {
      status: 1,
      message: 'Owner access',
      data: { unlocked: true, unlockType: 'owner', contact, ...serialized },
    };
  }

  const existing = await hasUnlockedListing(userId, listingId);
  if (existing) {
    return {
      status: 1,
      message: 'Contact already unlocked',
      data: { unlocked: true, unlockType: 'already', contact, ...serialized },
    };
  }

  const result = await withTransaction(async (conn) => {
    await connExecute(
      conn,
      `INSERT IGNORE INTO user_contact_wallets (user_id, credits_remaining, free_unlock_used)
       VALUES (?, 0, 0)`,
      [userId]
    );
    const wallets = await connQuery<any>(
      conn,
      `SELECT credits_remaining, free_unlock_used, plan_code, plan_expires_at
       FROM user_contact_wallets WHERE user_id = ? LIMIT 1 FOR UPDATE`,
      [userId]
    );
    const current = wallets[0];
    const unlockedRows = await connQuery<any>(
      conn,
      `SELECT id, unlock_type FROM contact_unlocks WHERE user_id = ? AND listing_id = ? LIMIT 1 FOR UPDATE`,
      [userId, listingId]
    );
    if (unlockedRows[0]) {
      return { kind: 'already' as const, unlockType: unlockedRows[0].unlock_type, walletRow: current };
    }

    const freeUsed = Boolean(Number(current?.free_unlock_used ?? 0));
    const planExpiresAt = current?.plan_expires_at ? new Date(current.plan_expires_at) : null;
    const planActive = isPlanActive(planExpiresAt);
    const credits = planActive ? Number(current?.credits_remaining ?? 0) : 0;
    const decision = decideUnlock({
      isOwner: false,
      alreadyUnlocked: false,
      freeUnlockUsed: freeUsed,
      creditsRemaining: credits,
      planActive,
    });

    if (decision.action === 'paywall') {
      return { kind: 'paywall' as const, walletRow: current };
    }

    const unlockType = 'credit';
    await connExecute(
      conn,
      `INSERT INTO contact_unlocks (user_id, listing_id, unlock_type) VALUES (?, ?, ?)`,
      [userId, listingId, unlockType]
    );

    await connExecute(
      conn,
      `UPDATE user_contact_wallets SET credits_remaining = GREATEST(credits_remaining - 1, 0) WHERE user_id = ?`,
      [userId]
    );
    current.credits_remaining = Math.max(0, Number(current.credits_remaining || 0) - 1);

    return { kind: 'unlocked' as const, unlockType, walletRow: current };
  });

  const freshWallet = {
    creditsRemaining: Number(result.walletRow?.credits_remaining ?? 0),
    freeUnlockUsed: Boolean(Number(result.walletRow?.free_unlock_used ?? 0)),
    planCode: result.walletRow?.plan_code ?? wallet.planCode,
    planExpiresAt: result.walletRow?.plan_expires_at ? new Date(result.walletRow.plan_expires_at) : wallet.planExpiresAt,
  };
  const walletData = serializeWallet({
    ...freshWallet,
    creditsRemaining: usableCredits(freshWallet),
  });

  if (result.kind === 'paywall') {
    return {
      status: 0,
      code: 'PAYMENT_REQUIRED',
      message: 'Buy a contact plan to view owner phone, WhatsApp, or email',
      data: { unlocked: false, ...walletData },
    };
  }

  return {
    status: 1,
    message: result.kind === 'already' ? 'Contact already unlocked' : 'Contact unlocked',
    data: {
      unlocked: true,
      unlockType: result.unlockType,
      contact,
      ...walletData,
    },
  };
}

export { ensureWallet };
