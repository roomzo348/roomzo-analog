import { sqlExecute, sqlQuery } from '../db/mysql';

function daysClause(days?: number, alias = ''): { sql: string; params: unknown[] } {
  if (!days || days <= 0) return { sql: '', params: [] };
  const prefix = alias ? `${alias}.` : '';
  return {
    sql: ` AND ${prefix}created_on >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    params: [days],
  };
}

export async function logActivity(payload: any): Promise<void> {
  let ownerId = payload?.ownerId ?? null;
  let city = payload?.city ?? null;
  let state = payload?.state ?? null;
  let zone = payload?.zone ?? null;
  const propertyId = payload?.propertyId ? Number(payload.propertyId) : null;

  if (propertyId && (!ownerId || !city || !state)) {
    const rows = await sqlQuery<any>(
      `SELECT owner_id as ownerId, city, state, zone FROM property_listings WHERE id = ? LIMIT 1`,
      [propertyId]
    );
    const listing = rows[0];
    if (listing) {
      ownerId = ownerId ?? listing.ownerId;
      city = city ?? listing.city;
      state = state ?? listing.state;
      zone = zone ?? listing.zone;
    }
  }

  await sqlExecute(
    `INSERT INTO activity_logs (
      event_type, user_id, property_id, owner_id, city, state, zone,
      search_query, contact_method, metadata, session_id, ip_address, user_agent, referrer, created_on
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      payload?.eventType,
      payload?.userId ?? null,
      propertyId,
      ownerId,
      city,
      state,
      zone,
      payload?.searchQuery ?? null,
      payload?.contactMethod ?? null,
      payload?.metadata ? JSON.stringify(payload.metadata) : null,
      payload?.sessionId ?? null,
      payload?.ipAddress ?? null,
      payload?.userAgent ?? null,
      payload?.referrer ?? null,
    ]
  );
}

export async function ownerMetrics(ownerId: number, days?: number): Promise<any> {
  const d = daysClause(days);
  const rows = await sqlQuery<any>(
    `SELECT property_id as propertyId,
            SUM(CASE WHEN event_type='PROPERTY_VIEW' THEN 1 ELSE 0 END) as views,
            SUM(CASE WHEN event_type='PROPERTY_CONTACT' THEN 1 ELSE 0 END) as contacts,
            SUM(CASE WHEN event_type='PROPERTY_SHARE' THEN 1 ELSE 0 END) as shares
     FROM activity_logs
     WHERE owner_id = ?${d.sql}
     GROUP BY property_id`,
    [ownerId, ...d.params]
  );
  return { properties: rows };
}

export async function propertyMetrics(propertyId: number, days?: number): Promise<any> {
  const d = daysClause(days);
  const rows = await sqlQuery<any>(
    `SELECT
      SUM(CASE WHEN event_type='PROPERTY_VIEW' THEN 1 ELSE 0 END) as views,
      SUM(CASE WHEN event_type='PROPERTY_CONTACT' THEN 1 ELSE 0 END) as contacts,
      SUM(CASE WHEN event_type='PROPERTY_SHARE' THEN 1 ELSE 0 END) as shares
     FROM activity_logs
     WHERE property_id = ?${d.sql}`,
    [propertyId, ...d.params]
  );
  const row = rows[0] ?? {};
  return { propertyId, views: Number(row.views ?? 0), contacts: Number(row.contacts ?? 0), shares: Number(row.shares ?? 0) };
}

export async function summary(days?: number): Promise<any> {
  const d = daysClause(days);
  const rows = await sqlQuery<any>(
    `SELECT event_type as eventType, COUNT(*) as total
     FROM activity_logs
     WHERE 1=1${d.sql}
     GROUP BY event_type`
    ,
    [...d.params]
  );
  return rows;
}

export async function mostByEvent(eventType: string, limit: number, days?: number): Promise<any[]> {
  const d = daysClause(days);
  return sqlQuery<any>(
    `SELECT property_id as propertyId, COUNT(*) as total
     FROM activity_logs
     WHERE event_type = ?${d.sql}
     GROUP BY property_id
     ORDER BY total DESC
     LIMIT ?`,
    [eventType, ...d.params, limit]
  );
}

export async function topAreas(eventType: string, limit: number, days?: number): Promise<any[]> {
  const d = daysClause(days);
  return sqlQuery<any>(
    `SELECT city, state, zone, COUNT(*) as total
     FROM activity_logs
     WHERE event_type = ?${d.sql}
     GROUP BY city, state, zone
     ORDER BY total DESC
     LIMIT ?`,
    [eventType, ...d.params, limit]
  );
}

export async function userActivity(userId: number, limit: number, days?: number): Promise<any[]> {
  const d = daysClause(days);
  return sqlQuery<any>(
    `SELECT * FROM activity_logs WHERE user_id = ?${d.sql} ORDER BY created_on DESC LIMIT ?`,
    [userId, ...d.params, limit]
  );
}

export async function userInsights(userId: number, limit: number, days?: number): Promise<any[]> {
  const d = daysClause(days);
  return sqlQuery<any>(
    `SELECT search_query as searchQuery, COUNT(*) as total
     FROM activity_logs
     WHERE user_id = ? AND event_type = 'SEARCH' AND search_query IS NOT NULL${d.sql}
     GROUP BY search_query
     ORDER BY total DESC
     LIMIT ?`,
    [userId, ...d.params, limit]
  );
}

export async function recentActivity(limit: number, event?: string, days?: number): Promise<any[]> {
  const d = daysClause(days);
  if (event) {
    return sqlQuery<any>(
      `SELECT * FROM activity_logs WHERE event_type = ?${d.sql} ORDER BY created_on DESC LIMIT ?`,
      [event, ...d.params, limit]
    );
  }
  return sqlQuery<any>(`SELECT * FROM activity_logs WHERE 1=1${d.sql} ORDER BY created_on DESC LIMIT ?`, [
    ...d.params,
    limit,
  ]);
}
