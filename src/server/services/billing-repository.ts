import { sqlExecute, sqlQuery, connQuery, connExecute, withTransaction } from '../db/mysql';
import { CONTACT_PLANS, getContactPlan, type ContactPlan, type PlanCode } from '../config/plans';
import { nextPlanExpiry, usableCredits, type WalletSnapshot } from '../utils/contact-access';
import {
  fetchCashfreeOrder,
  getCashfreeConfig,
  isPaidCashfreeOrder,
  resolveCashfreePaymentId,
} from './cashfree.service';

let tablesReady = false;

export async function ensureBillingTables(): Promise<void> {
  if (tablesReady) return;
  await sqlExecute(
    `CREATE TABLE IF NOT EXISTS user_contact_wallets (
      user_id INT NOT NULL PRIMARY KEY,
      credits_remaining INT NOT NULL DEFAULT 0,
      free_unlock_used TINYINT(1) NOT NULL DEFAULT 0,
      plan_code VARCHAR(16) NULL,
      plan_expires_at DATETIME NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );
  await sqlExecute(
    `CREATE TABLE IF NOT EXISTS contact_unlocks (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      listing_id INT NOT NULL,
      unlock_type VARCHAR(16) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_contact_unlock (user_id, listing_id),
      KEY idx_contact_unlocks_user (user_id),
      KEY idx_contact_unlocks_listing (listing_id)
    )`
  );
  await sqlExecute(
    `CREATE TABLE IF NOT EXISTS billing_payments (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      plan_code VARCHAR(16) NOT NULL,
      amount_paise INT NOT NULL,
      currency VARCHAR(8) NOT NULL DEFAULT 'INR',
      credits_granted INT NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'created',
      razorpay_order_id VARCHAR(64) NULL,
      razorpay_payment_id VARCHAR(64) NULL,
      razorpay_signature VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME NULL,
      UNIQUE KEY uk_billing_order (razorpay_order_id),
      KEY idx_billing_payments_user (user_id),
      KEY idx_billing_payments_status (status)
    )`
  );
  tablesReady = true;
}

function mapWallet(row: any | undefined): WalletSnapshot {
  return {
    creditsRemaining: Number(row?.credits_remaining ?? 0),
    freeUnlockUsed: Boolean(Number(row?.free_unlock_used ?? 0)),
    planCode: row?.plan_code ?? null,
    planExpiresAt: row?.plan_expires_at ? new Date(row.plan_expires_at) : null,
  };
}

export async function ensureWallet(userId: number): Promise<void> {
  await ensureBillingTables();
  await sqlExecute(
    `INSERT IGNORE INTO user_contact_wallets (user_id, credits_remaining, free_unlock_used)
     VALUES (?, 0, 0)`,
    [userId]
  );
}

export async function getWallet(userId: number): Promise<WalletSnapshot> {
  await ensureWallet(userId);
  const rows = await sqlQuery<any>(
    `SELECT credits_remaining, free_unlock_used, plan_code, plan_expires_at
     FROM user_contact_wallets WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  const wallet = mapWallet(rows[0]);
  // Report only what is spendable right now, but never write that back: a plain
  // read must not destroy a balance the user paid for. Access is gated by
  // usableCredits() at every spend point, so the stored number stays intact.
  return { ...wallet, creditsRemaining: usableCredits(wallet) };
}

export async function createPendingPayment(input: {
  userId: number;
  plan: ContactPlan;
  /** Cashfree order_id (stored in gateway order column). */
  orderId: string;
}): Promise<void> {
  await ensureBillingTables();
  await sqlExecute(
    `INSERT INTO billing_payments
      (user_id, plan_code, amount_paise, currency, credits_granted, status, razorpay_order_id)
     VALUES (?, ?, ?, ?, 0, 'created', ?)
     ON DUPLICATE KEY UPDATE plan_code = VALUES(plan_code), amount_paise = VALUES(amount_paise)`,
    [
      input.userId,
      input.plan.code,
      input.plan.amountPaise,
      input.plan.currency,
      input.orderId,
    ]
  );
}

export async function getPaymentByOrderId(orderId: string): Promise<any | null> {
  await ensureBillingTables();
  const rows = await sqlQuery<any>(
    `SELECT * FROM billing_payments WHERE razorpay_order_id = ? LIMIT 1`,
    [orderId]
  );
  return rows[0] ?? null;
}

export async function listPendingPaymentsForUser(userId: number): Promise<any[]> {
  await ensureBillingTables();
  return sqlQuery<any>(
    `SELECT * FROM billing_payments
     WHERE user_id = ? AND status = 'created' AND razorpay_order_id IS NOT NULL
     ORDER BY id ASC`,
    [userId]
  );
}

export async function markPaymentFailed(orderId: string, paymentId?: string): Promise<void> {
  await ensureBillingTables();
  await sqlExecute(
    `UPDATE billing_payments
     SET status = 'failed', razorpay_payment_id = COALESCE(?, razorpay_payment_id)
     WHERE razorpay_order_id = ? AND status <> 'paid'`,
    [paymentId ?? null, orderId]
  );
}

export async function fulfillPaidOrder(input: {
  orderId: string;
  paymentId: string;
  signature?: string | null;
}): Promise<{ alreadyPaid: boolean; wallet: WalletSnapshot; plan: ContactPlan | null }> {
  await ensureBillingTables();
  return withTransaction(async (conn) => {
    const payments = await connQuery<any>(
      conn,
      `SELECT * FROM billing_payments WHERE razorpay_order_id = ? LIMIT 1 FOR UPDATE`,
      [input.orderId]
    );
    const payment = payments[0];
    if (!payment) {
      throw new Error('Payment order not found');
    }

    const plan = getContactPlan(payment.plan_code);
    if (payment.status === 'paid') {
      const wallets = await connQuery<any>(
        conn,
        `SELECT credits_remaining, free_unlock_used, plan_code, plan_expires_at
         FROM user_contact_wallets WHERE user_id = ? LIMIT 1`,
        [payment.user_id]
      );
      return { alreadyPaid: true, wallet: mapWallet(wallets[0]), plan };
    }

    await connExecute(
      conn,
      `INSERT IGNORE INTO user_contact_wallets (user_id, credits_remaining, free_unlock_used)
       VALUES (?, 0, 0)`,
      [payment.user_id]
    );
    const wallets = await connQuery<any>(
      conn,
      `SELECT credits_remaining, free_unlock_used, plan_code, plan_expires_at
       FROM user_contact_wallets WHERE user_id = ? LIMIT 1 FOR UPDATE`,
      [payment.user_id]
    );
    const current = mapWallet(wallets[0]);
    const usable = usableCredits(current);
    const credits = Number(plan?.contacts || 0);
    if (credits <= 0) {
      throw new Error('Cannot grant credits for an unknown plan');
    }
    const durationDays = plan?.durationDays ?? CONTACT_PLANS.starter.durationDays;
    const expiry = nextPlanExpiry(current.planExpiresAt, durationDays);
    const nextCredits = usable + credits;
    const planCode = (plan?.code ?? payment.plan_code) as PlanCode;

    await connExecute(
      conn,
      `UPDATE user_contact_wallets
       SET credits_remaining = ?, plan_code = ?, plan_expires_at = ?
       WHERE user_id = ?`,
      [nextCredits, planCode, expiry, payment.user_id]
    );
    await connExecute(
      conn,
      `UPDATE billing_payments
       SET status = 'paid', credits_granted = ?, razorpay_payment_id = ?, razorpay_signature = ?, paid_at = NOW()
       WHERE razorpay_order_id = ? AND status <> 'paid'`,
      [credits, input.paymentId, input.signature ?? null, input.orderId]
    );

    return {
      alreadyPaid: false,
      wallet: {
        creditsRemaining: nextCredits,
        freeUnlockUsed: current.freeUnlockUsed,
        planCode,
        planExpiresAt: expiry,
      },
      plan,
    };
  });
}

export function serializeWallet(wallet: WalletSnapshot) {
  return {
    creditsRemaining: usableCredits(wallet),
    freeUnlockAvailable: false,
    planCode: wallet.planCode,
    planExpiresAt: wallet.planExpiresAt ? wallet.planExpiresAt.toISOString() : null,
    // Points never expire, so "active" simply means there is something to spend.
    planActive: usableCredits(wallet) > 0,
  };
}

/**
 * Credits can stay at zero when checkout finished but /verify never ran.
 * Re-check open orders against Cashfree and fulfil any that are PAID.
 */
export async function reconcilePendingPaymentsForUser(userId: number): Promise<WalletSnapshot | null> {
  if (!getCashfreeConfig().configured) return null;

  const pending = await listPendingPaymentsForUser(userId);
  if (!pending.length) return null;

  let latestWallet: WalletSnapshot | null = null;
  for (const payment of pending) {
    const orderId = String(payment.razorpay_order_id || '');
    if (!orderId) continue;
    try {
      const remote = await fetchCashfreeOrder(orderId);
      if (!isPaidCashfreeOrder(remote.order_status)) continue;
      const expectedRupees = Number(payment.amount_paise) / 100;
      if (
        Number.isFinite(remote.order_amount) &&
        Math.abs(Number(remote.order_amount) - expectedRupees) > 0.01
      ) {
        continue;
      }
      const paymentId = (await resolveCashfreePaymentId(orderId)) || `cf_${orderId}`;
      const fulfilled = await fulfillPaidOrder({
        orderId,
        paymentId,
        signature: null,
      });
      latestWallet = fulfilled.wallet;
    } catch {
      // Keep trying older pending orders.
    }
  }
  return latestWallet;
}
