import { connExecute, connQuery, withTransaction } from '../db/mysql';
import { ensureWallet } from './billing-repository';
import { ensureListingSchema } from './listing-repository';
import { getListingRewardConfig } from '../utils/runtime-config';

export async function creditListingRewardOnce(
  listingId: number,
  userId: number
): Promise<{ credited: boolean; credits: number }> {
  const { credits } = getListingRewardConfig();
  if (!listingId || !userId || credits <= 0) {
    return { credited: false, credits };
  }
  await ensureListingSchema();
  await ensureWallet(userId);

  return withTransaction(async (conn) => {
    const insert = await connExecute(
      `INSERT IGNORE INTO listing_reward_credits (listing_id, user_id, credits)
       VALUES (?, ?, ?)`,
      [listingId, userId, credits]
    );
    if (!insert.affectedRows) {
      return { credited: false, credits };
    }
    await connExecute(
      `UPDATE user_contact_wallets
       SET credits_remaining = credits_remaining + ?
       WHERE user_id = ?`,
      [credits, userId]
    );
    await connExecute(
      `UPDATE property_listings SET reward_credited_at = NOW() WHERE id = ?`,
      [listingId]
    );
    const check = await connQuery<{ listing_id: number }>(
      `SELECT listing_id FROM listing_reward_credits WHERE listing_id = ? LIMIT 1`,
      [listingId]
    );
    return { credited: check.length > 0, credits };
  });
}
