import { sqlExecute } from '../db/mysql';

export async function submitPropertyReport(payload: any): Promise<void> {
  await sqlExecute(
    `INSERT INTO property_reports (
      property_id, property_name, owner_id, reporter_email, reason, status, reported_at
    ) VALUES (?, ?, ?, ?, ?, 'PENDING', NOW())`,
    [
      String(payload?.propertyId ?? ''),
      String(payload?.propertyName ?? ''),
      String(payload?.ownerId ?? ''),
      String(payload?.reporterEmail ?? ''),
      String(payload?.reason ?? ''),
    ]
  );
}
