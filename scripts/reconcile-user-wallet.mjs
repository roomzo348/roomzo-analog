import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const userId = Number(process.argv[2] || 3);
const keyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
if (!keyId || !keySecret) {
  console.error('Missing Razorpay keys in .env');
  process.exit(1);
}

const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

async function orderPayments(orderId) {
  const res = await fetch(`https://api.razorpay.com/v1/orders/${orderId}/payments`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    throw new Error(`Razorpay ${res.status}`);
  }
  return res.json();
}

function isFailed(status) {
  return String(status || '').toLowerCase() === 'failed';
}

function isPaid(status) {
  const value = String(status || '').toLowerCase();
  return value === 'captured' || value === 'authorized' || value === 'created';
}

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'roomzo',
});

const [pending] = await conn.query(
  `SELECT id, razorpay_order_id, amount_paise, plan_code, status
   FROM billing_payments
   WHERE user_id = ? AND status = 'created' AND razorpay_order_id IS NOT NULL
   ORDER BY id ASC`,
  [userId]
);

console.log(`Pending orders for user ${userId}:`, pending.length);

for (const payment of pending) {
  const orderId = payment.razorpay_order_id;
  try {
    const data = await orderPayments(orderId);
    const items = data.items || [];
    console.log(orderId, items.map((i) => `${i.id}:${i.status}:${i.amount}`).join(' | ') || 'no payments');

    const match = items.find(
      (item) =>
        Number(item.amount) === Number(payment.amount_paise) &&
        !isFailed(item.status) &&
        isPaid(item.status)
    );
    if (!match) continue;

    await conn.beginTransaction();
    const [wallets] = await conn.query(
      `SELECT credits_remaining, free_unlock_used, plan_code, plan_expires_at
       FROM user_contact_wallets WHERE user_id = ? LIMIT 1 FOR UPDATE`,
      [userId]
    );
    if (!wallets.length) {
      await conn.query(
        `INSERT IGNORE INTO user_contact_wallets (user_id, credits_remaining, free_unlock_used) VALUES (?, 0, 0)`,
        [userId]
      );
    }
    const [walletRows] = await conn.query(
      `SELECT credits_remaining, free_unlock_used, plan_code, plan_expires_at
       FROM user_contact_wallets WHERE user_id = ? LIMIT 1 FOR UPDATE`,
      [userId]
    );
    const current = walletRows[0] || { credits_remaining: 0, plan_code: null, plan_expires_at: null };
    const planCredits = { starter: 4, plus: 10, pro: 25 }[payment.plan_code] || 0;
    const nextCredits = Number(current.credits_remaining || 0) + planCredits;
    const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await conn.query(
      `UPDATE user_contact_wallets SET credits_remaining = ?, plan_code = ?, plan_expires_at = ? WHERE user_id = ?`,
      [nextCredits, payment.plan_code, expiry, userId]
    );
    await conn.query(
      `UPDATE billing_payments
       SET status = 'paid', credits_granted = ?, razorpay_payment_id = ?, paid_at = NOW()
       WHERE id = ? AND status <> 'paid'`,
      [planCredits, match.id, payment.id]
    );
    await conn.commit();
    console.log(`Fulfilled ${orderId} -> +${planCredits} credits (total ${nextCredits})`);
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    console.error('Failed', orderId, err.message);
  }
}

const [wallet] = await conn.query(
  `SELECT credits_remaining, plan_code FROM user_contact_wallets WHERE user_id = ?`,
  [userId]
);
console.log('Final wallet:', wallet[0] || { credits_remaining: 0 });
await conn.end();
