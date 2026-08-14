import { randomBytes } from 'node:crypto';
import { sqlExecute, sqlQuery } from '../db/mysql';

const SESSION_DAYS = 30;
let tableReady = false;

export async function ensureSessionTable(): Promise<void> {
  if (tableReady) return;
  await sqlExecute(
    `CREATE TABLE IF NOT EXISTS user_sessions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      session_token VARCHAR(64) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      last_seen_at DATETIME NULL,
      user_agent VARCHAR(255) NULL,
      ip_address VARCHAR(45) NULL,
      UNIQUE KEY uk_session_token (session_token),
      KEY idx_user_sessions_user_id (user_id),
      KEY idx_user_sessions_expires_at (expires_at)
    )`
  );
  tableReady = true;
}

export async function createUserSession(
  userId: number,
  meta: { userAgent?: string; ip?: string } = {}
): Promise<string> {
  await ensureSessionTable();
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  // Single active session per user — new login logs out older devices.
  await sqlExecute(`DELETE FROM user_sessions WHERE user_id = ?`, [userId]);

  await sqlExecute(
    `INSERT INTO user_sessions (user_id, session_token, expires_at, last_seen_at, user_agent, ip_address)
     VALUES (?, ?, ?, NOW(), ?, ?)`,
    [userId, token, expiresAt, meta.userAgent ?? null, meta.ip ?? null]
  );

  return token;
}

export async function validateUserSession(token: string): Promise<number | null> {
  if (!token) return null;
  await ensureSessionTable();
  const rows = await sqlQuery<{ user_id: number }>(
    `SELECT user_id FROM user_sessions WHERE session_token = ? AND expires_at > NOW() LIMIT 1`,
    [token]
  );
  if (!rows[0]) return null;

  await sqlExecute(`UPDATE user_sessions SET last_seen_at = NOW() WHERE session_token = ?`, [token]);
  return Number(rows[0].user_id);
}

export async function revokeUserSession(token: string): Promise<void> {
  if (!token) return;
  await ensureSessionTable();
  await sqlExecute(`DELETE FROM user_sessions WHERE session_token = ?`, [token]);
}
