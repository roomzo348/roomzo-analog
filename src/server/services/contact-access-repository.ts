import { connExecute, connQuery, sqlQuery, withTransaction } from '../db/mysql';
import { getListingById } from './listing-repository';
import { getOwnerInfo } from './auth-repository';
import {
  ensureBillingTables,
  ensureWallet,
  getWallet,
  serializeWallet,
} from './billing-repository';
import { decideUnlock, usableCredits } from '../utils/contact-access';

export async function hasUnlockedListing(userId: number, listingId: number): Promise<boolean> {
  await ensureBillingTables();
  const rows = await sqlQuery<{ id: number; unlock_type?: string }>(
    `SELECT id, unlock_type FROM contact_unlocks WHERE user_id = ? AND listing_id = ? LIMIT 1`,
    [userId, listingId]
  );
  const type = String(rows[0]?.unlock_type || '');
  return Boolean(rows[0]) && type !== 'free';
}

export async function canRevealContact(userId: number, listingId: number): Promise<boolean> {
  // Once paid-unlocked, the listing stays visible forever for that user.
  return hasUnlockedListing(userId, listingId);
}

export async function getUnlockedListingIds(userId: number): Promise<number[]> {
  await ensureBillingTables();
  const rows = await sqlQuery<{ listing_id: number }>(
    `SELECT listing_id FROM contact_unlocks WHERE user_id = ?`,
    [userId]
  );
  return rows.map((row) => Number(row.listing_id));
}

/**
 * Listing ids whose owner contact this user may see. Batched alternative to
 * calling canRevealContact() per listing. Legacy 'free' unlocks never qualify.
 */
export async function getRevealableListingIds(userId: number): Promise<Set<number>> {
  await ensureBillingTables();
  const rows = await sqlQuery<{ listing_id: number }>(
    `SELECT listing_id FROM contact_unlocks WHERE user_id = ? AND unlock_type <> 'free'`,
    [userId]
  );
  return new Set(rows.map((row) => Number(row.listing_id)));
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
      data: { unlocked: true, unlockType: 'owner', creditsSpent: 0, contact, ...serialized },
    };
  }

  // Fast path: already unlocked → never charge again.
  const existing = await hasUnlockedListing(userId, listingId);
  if (existing) {
    return {
      status: 1,
      message: 'Contact already unlocked',
      data: {
        unlocked: true,
        unlockType: 'already',
        creditsSpent: 0,
        contact,
        ...serializeWallet(await getWallet(userId)),
      },
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

    // Another request unlocked this listing while we waited for the lock.
    if (unlockedRows[0] && String(unlockedRows[0].unlock_type) !== 'free') {
      return { kind: 'already' as const, unlockType: unlockedRows[0].unlock_type, walletRow: current };
    }

    const freeUsed = Boolean(Number(current?.free_unlock_used ?? 0));
    const credits = Math.max(0, Number(current?.credits_remaining ?? 0));
    const decision = decideUnlock({
      isOwner: false,
      alreadyUnlocked: false,
      freeUnlockUsed: freeUsed,
      creditsRemaining: credits,
    });

    if (decision.action === 'paywall') {
      return { kind: 'paywall' as const, walletRow: current };
    }

    // Insert-first: only deduct when we actually create a new unlock row.
    // Duplicate key means a concurrent request won — treat as already unlocked.
    let inserted = false;
    if (unlockedRows[0] && String(unlockedRows[0].unlock_type) === 'free') {
      await connExecute(
        conn,
        `UPDATE contact_unlocks SET unlock_type = 'credit' WHERE user_id = ? AND listing_id = ? AND unlock_type = 'free'`,
        [userId, listingId]
      );
      inserted = true;
    } else {
      try {
        const insertResult = await connExecute(
          conn,
          `INSERT INTO contact_unlocks (user_id, listing_id, unlock_type) VALUES (?, ?, 'credit')`,
          [userId, listingId]
        );
        inserted = Number(insertResult.affectedRows || 0) === 1;
      } catch (error: any) {
        // ER_DUP_ENTRY — concurrent unlock already committed.
        if (error?.code === 'ER_DUP_ENTRY' || Number(error?.errno) === 1062) {
          return { kind: 'already' as const, unlockType: 'credit', walletRow: current };
        }
        throw error;
      }
    }

    if (!inserted) {
      return { kind: 'already' as const, unlockType: 'credit', walletRow: current };
    }

    await connExecute(
      conn,
      `UPDATE user_contact_wallets SET credits_remaining = GREATEST(credits_remaining - 1, 0) WHERE user_id = ?`,
      [userId]
    );
    current.credits_remaining = Math.max(0, Number(current.credits_remaining || 0) - 1);

    return { kind: 'unlocked' as const, unlockType: 'credit', walletRow: current };
  });

  const walletAfterUnlock = await getWallet(userId);
  const walletData = serializeWallet(walletAfterUnlock);

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
      creditsSpent: result.kind === 'unlocked' ? 1 : 0,
      contact,
      ...walletData,
    },
  };
}

export { ensureWallet };
