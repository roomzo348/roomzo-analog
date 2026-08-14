import bcrypt from 'bcryptjs';
import { sqlExecute, sqlQuery } from '../db/mysql';

function generateOtpCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function sendOtp(identifier: string): Promise<{ otp: string }> {
  const otp = generateOtpCode();
  await sqlExecute(
    `INSERT INTO otp_requests (email, otp_code, expiry_time)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))
     ON DUPLICATE KEY UPDATE otp_code = VALUES(otp_code), expiry_time = VALUES(expiry_time)`,
    [identifier, otp]
  );
  return { otp };
}

export async function verifyOtp(identifier: string, otp: string): Promise<boolean> {
  const rows = await sqlQuery<{ id: number }>(
    `SELECT id FROM otp_requests WHERE email = ? AND otp_code = ? AND expiry_time >= NOW() LIMIT 1`,
    [identifier, otp]
  );
  if (!rows[0]) return false;
  await sqlExecute(`DELETE FROM otp_requests WHERE email = ?`, [identifier]);
  return true;
}

export async function registerUser(payload: any): Promise<any> {
  const name = payload?.name ?? payload?.fullName ?? 'User';
  const identifier = payload?.email ?? payload?.phone ?? '';
  const phone = payload?.phone ?? identifier;
  const email = payload?.email ?? identifier;
  const usertype = payload?.usertype ?? payload?.userType ?? 'USER';
  const password = String(payload?.password ?? '');
  const passwordHash = await bcrypt.hash(password, 12);

  const result = await sqlExecute(
    `INSERT INTO users (name, display_name, phone, email, usertype, created_on)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [name, payload?.displayName ?? name, phone, email, usertype]
  );
  const userId = result.insertId;
  await sqlExecute(`INSERT INTO user_credentials (user_id, password_hash) VALUES (?, ?)`, [
    userId,
    passwordHash,
  ]);
  return getUserById(Number(userId));
}

export async function loginUser(identifier: string, password: string): Promise<any | null> {
  const users = await sqlQuery<any>(
    `SELECT u.*, c.password_hash as passwordHash
     FROM users u
     LEFT JOIN user_credentials c ON c.user_id = u.id
     WHERE u.email = ? OR u.phone = ?
     LIMIT 1`,
    [identifier, identifier]
  );
  const user = users[0];
  if (!user || !user.passwordHash) return null;
  const ok = await bcrypt.compare(password, String(user.passwordHash));
  if (!ok) return null;
  return sanitizeUser(user);
}

export async function getOwnerInfo(ownerId: number): Promise<any | null> {
  const rows = await sqlQuery<any>(`SELECT id, name, email, phone FROM users WHERE id = ? LIMIT 1`, [
    ownerId,
  ]);
  const user = rows[0];
  if (!user) return null;
  return { name: user.name, email: user.email, phone: user.phone };
}

export async function forgotPasswordInit(identifier: string): Promise<{ otp: string } | null> {
  const rows = await sqlQuery<any>(`SELECT id, email, phone FROM users WHERE email = ? OR phone = ? LIMIT 1`, [
    identifier,
    identifier,
  ]);
  const user = rows[0];
  if (!user) return null;
  const channel = user.email || user.phone;
  return sendOtp(channel);
}

export async function resetPassword(email: string, otp: string, password: string): Promise<boolean> {
  const verified = await verifyOtp(email, otp);
  if (!verified) return false;
  const users = await sqlQuery<any>(`SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1`, [email, email]);
  const user = users[0];
  if (!user) return false;
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await sqlExecute(
    `UPDATE user_credentials SET password_hash = ? WHERE user_id = ?`,
    [passwordHash, user.id]
  );
  return result.affectedRows > 0;
}

export async function getUserById(userId: number): Promise<any | null> {
  const rows = await sqlQuery<any>(`SELECT * FROM users WHERE id = ? LIMIT 1`, [userId]);
  return rows[0] ? sanitizeUser(rows[0]) : null;
}

function sanitizeUser(user: any): any {
  return {
    id: user.id,
    name: user.name,
    displayName: user.display_name ?? user.displayName ?? user.name,
    phone: user.phone,
    email: user.email,
    usertype: user.usertype,
    age: user.age,
    address: user.address,
    city: user.city,
    state: user.state,
    profilePhotoUrl: user.profile_photo_url ?? user.profilePhotoUrl ?? null,
    createdOn: user.created_on ?? user.createdOn,
  };
}
