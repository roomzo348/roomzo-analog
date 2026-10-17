import { connExecute, connQuery, withTransaction } from '../db/mysql';
import { ensureWallet } from './billing-repository';
import { ensureListingSchema } from './listing-repository';
import { getListingRewardConfig } from '../utils/runtime-config';

export async function creditListingRewardOnce(
  listingId: number,
  userId: number
): Promise<{ credited: boolean; credits: number }> {
  const { credits } = getListingRewardConfig();
  if (!listingId || !userId) {
    throw new Error('Cannot credit points: listing owner is missing');
  }
  if (credits <= 0) {
    return { credited: false, credits };
  }
  await ensureListingSchema();
  await ensureWallet(userId);

  return withTransaction(async (conn) => {
    await connExecute(
      conn,
      `INSERT INTO user_contact_wallets (user_id, credits_remaining, free_unlock_used)
       VALUES (?, 0, 0)
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      [userId]
    );

    const existing = await connQuery<{ listing_id: number; credits: number }>(
      conn,
      `SELECT listing_id, credits FROM listing_reward_credits WHERE listing_id = ? LIMIT 1`,
      [listingId]
    );
    const listingRows = await connQuery<{ reward_credited_at: string | null }>(
      conn,
      `SELECT reward_credited_at FROM property_listings WHERE id = ? LIMIT 1`,
      [listingId]
    );
    const alreadyLedger = existing.length > 0;
    const alreadyWallet = Boolean(listingRows[0]?.reward_credited_at);

    if (alreadyLedger && alreadyWallet) {
      return { credited: false, credits: Number(existing[0].credits) || credits };
    }

    if (!alreadyLedger) {
      await connExecute(
        conn,
        `INSERT INTO listing_reward_credits (listing_id, user_id, credits)
         VALUES (?, ?, ?)`,
        [listingId, userId, credits]
      );
    }

    const walletUpdate = await connExecute(
      conn,
      `UPDATE user_contact_wallets
       SET credits_remaining = credits_remaining + ?
       WHERE user_id = ?`,
      [credits, userId]
    );
    if (!walletUpdate.affectedRows) {
      throw new Error('Could not add contact points to wallet');
    }
    await connExecute(
      conn,
      `UPDATE property_listings SET reward_credited_at = NOW() WHERE id = ?`,
      [listingId]
    );
    return { credited: true, credits };
  });
}
