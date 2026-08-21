import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const userId = Number(process.argv[2] || 3);
const appId = String(process.env.CASHFREE_APP_ID || process.env.CASHFREE_CLIENT_ID || '').trim();
const secretKey = String(
  process.env.CASHFREE_SECRET_KEY || process.env.CASHFREE_CLIENT_SECRET || ''
).trim();
const env = String(process.env.CASHFREE_ENV || 'sandbox').toLowerCase();
const apiBase =
  env === 'production' || env === 'live'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

if (!appId || !secretKey) {
  console.error('Missing Cashfree keys in .env (CASHFREE_APP_ID / CASHFREE_SECRET_KEY)');
  process.exit(1);
}

async function fetchOrder(orderId) {
  const res = await fetch(`${apiBase}/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      Accept: 'application/json',
      'x-api-version': '2023-08-01',
      'x-client-id': appId,
      'x-client-secret': secretKey,
    },
  });
  if (!res.ok) {
    throw new Error(`Cashfree ${res.status}`);
  }
  return res.json();
}

async function fetchPayments(orderId) {
  const res = await fetch(`${apiBase}/orders/${encodeURIComponent(orderId)}/payments`, {
    headers: {
      Accept: 'application/json',
      'x-api-version': '2023-08-01',
      'x-client-id': appId,
      'x-client-secret': secretKey,
    },
  });
  if (!res.ok) return { payments: [] };
  return res.json();
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

const planCredits = { starter: 4, plus: 10, pro: 25 };

for (const payment of pending) {
  const orderId = payment.razorpay_order_id;
  try {
    const order = await fetchOrder(orderId);
    console.log(orderId, order.order_status, order.order_amount);
    if (String(order.order_status || '').toUpperCase() !== 'PAID') continue;

    const expected = Number(payment.amount_paise) / 100;
    if (Math.abs(Number(order.order_amount) - expected) > 0.01) {
      console.log('amount mismatch, skip');
      continue;
    }

    const payData = await fetchPayments(orderId);
    const payments = payData.payments || [];
    const success = payments.find((p) => String(p.payment_status || '').toUpperCase() === 'SUCCESS');
    const paymentId = String(success?.cf_payment_id || `cf_${orderId}`);
    const credits = planCredits[payment.plan_code] || 0;
    if (!credits) continue;

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
    const [fresh] = await conn.query(
      `SELECT credits_remaining FROM user_contact_wallets WHERE user_id = ? LIMIT 1 FOR UPDATE`,
      [userId]
    );
    const next = Number(fresh[0]?.credits_remaining || 0) + credits;
    await conn.query(
      `UPDATE user_contact_wallets
       SET credits_remaining = ?, plan_code = ?, plan_expires_at = DATE_ADD(NOW(), INTERVAL 30 DAY)
       WHERE user_id = ?`,
      [next, payment.plan_code, userId]
    );
    await conn.query(
      `UPDATE billing_payments
       SET status = 'paid', credits_granted = ?, razorpay_payment_id = ?, paid_at = NOW()
       WHERE razorpay_order_id = ? AND status <> 'paid'`,
      [credits, paymentId, orderId]
    );
    await conn.commit();
    console.log('fulfilled', orderId, 'credits now', next);
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore
    }
    console.error(orderId, err.message || err);
  }
}

const [wallet] = await conn.query(
  `SELECT * FROM user_contact_wallets WHERE user_id = ?`,
  [userId]
);
console.log('wallet', wallet);
await conn.end();
