import { sqlExecute, sqlQuery } from '../db/mysql';

export async function saveSafetyConsent(userId: number, safetyConsentGiven: boolean): Promise<void> {
  await sqlExecute(
    `INSERT INTO user_consents (user_id, safety_consent_given, safety_consent_date, created_at)
     VALUES (?, ?, IF(? = 1, NOW(), NULL), NOW())
     ON DUPLICATE KEY UPDATE
       safety_consent_given = VALUES(safety_consent_given),
       safety_consent_date = IF(VALUES(safety_consent_given) = 1, NOW(), safety_consent_date)`,
    [userId, safetyConsentGiven ? 1 : 0, safetyConsentGiven ? 1 : 0]
  );
}

export async function hasSafetyConsent(userId: number): Promise<boolean> {
  const rows = await sqlQuery<{ safety_consent_given: number }>(
    `SELECT safety_consent_given FROM user_consents WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  return Number(rows[0]?.safety_consent_given ?? 0) === 1;
}
