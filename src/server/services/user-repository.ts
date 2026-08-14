import { sqlExecute, sqlQuery } from '../db/mysql';

export async function getUserProfile(userId: number): Promise<any | null> {
  const rows = await sqlQuery<any>(`SELECT * FROM users WHERE id = ? LIMIT 1`, [userId]);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    phone: row.phone,
    email: row.email,
    usertype: row.usertype,
    age: row.age,
    address: row.address,
    city: row.city,
    state: row.state,
    profilePhotoUrl: row.profile_photo_url,
    createdOn: row.created_on,
  };
}

export async function updateUserProfile(userId: number, payload: any): Promise<boolean> {
  const result = await sqlExecute(
    `UPDATE users
     SET name = COALESCE(?, name),
         display_name = COALESCE(?, display_name),
         age = ?,
         address = ?,
         city = ?,
         state = ?,
         profile_photo_url = COALESCE(?, profile_photo_url)
     WHERE id = ?`,
    [
      payload?.name ?? null,
      payload?.displayName ?? null,
      payload?.age ?? null,
      payload?.address ?? null,
      payload?.city ?? null,
      payload?.state ?? null,
      payload?.profilePhotoUrl ?? null,
      userId,
    ]
  );
  return result.affectedRows > 0;
}
