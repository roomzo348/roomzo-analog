import { sqlExecute, sqlQuery } from '../db/mysql';

function mapFlatmate(base: any, preferences: string[], images: string[]): any {
  return {
    id: base.id,
    userId: base.userId,
    name: base.name,
    age: base.age,
    gender: base.gender,
    profession: base.profession,
    budget: base.budget,
    bio: base.bio,
    flatAddress: base.flatAddress,
    city: base.city,
    latitude: base.latitude,
    longitude: base.longitude,
    phoneNumber: base.phoneNumber,
    isActive: Number(base.isActive ?? 1) === 1,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
    preferences,
    images,
  };
}

async function hydrate(posts: any[]): Promise<any[]> {
  if (!posts.length) return [];
  const ids = posts.map((p) => Number(p.id));
  const marks = ids.map(() => '?').join(',');
  const prefs = await sqlQuery<any>(
    `SELECT post_id as postId, preference FROM flatmate_preferences WHERE post_id IN (${marks})`,
    ids
  );
  const imgs = await sqlQuery<any>(
    `SELECT post_id as postId, image_url as imageUrl FROM flatmate_images WHERE post_id IN (${marks})`,
    ids
  );
  return posts.map((post) =>
    mapFlatmate(
      post,
      prefs.filter((p) => Number(p.postId) === Number(post.id)).map((p) => p.preference),
      imgs.filter((i) => Number(i.postId) === Number(post.id)).map((i) => i.imageUrl)
    )
  );
}

export async function getFlatmateMemoryFeed(limit = 25): Promise<any[]> {
  const rows = await sqlQuery<any>(
    `SELECT id, user_id as userId, name, age, gender, profession, budget, bio, flat_address as flatAddress, city, latitude, longitude, phone_number as phoneNumber, is_active as isActive, created_at as createdAt, updated_at as updatedAt
     FROM flatmate_posts WHERE is_active = 1 ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
  return hydrate(rows);
}

export async function getFlatmateNearby(page: number, size: number): Promise<{ content: any[]; totalElements: number; totalPages: number; number: number; }> {
  const p = Math.max(0, Number(page || 0));
  const s = Math.max(1, Math.min(50, Number(size || 10)));
  const offset = p * s;
  const countRows = await sqlQuery<{ total: number }>(`SELECT COUNT(*) as total FROM flatmate_posts WHERE is_active = 1`);
  const rows = await sqlQuery<any>(
    `SELECT id, user_id as userId, name, age, gender, profession, budget, bio, flat_address as flatAddress, city, latitude, longitude, phone_number as phoneNumber, is_active as isActive, created_at as createdAt, updated_at as updatedAt
     FROM flatmate_posts WHERE is_active = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [s, offset]
  );
  const content = await hydrate(rows);
  const total = Number(countRows[0]?.total ?? 0);
  return {
    content,
    totalElements: total,
    totalPages: total === 0 ? 0 : Math.ceil(total / s),
    number: p,
  };
}

export async function createFlatmatePost(post: any, userId: number): Promise<any> {
  const existing = await sqlQuery<{ id: number }>(
    `SELECT id FROM flatmate_posts WHERE user_id = ?`,
    [userId]
  );
  for (const row of existing) {
    await sqlExecute(`DELETE FROM flatmate_preferences WHERE post_id = ?`, [row.id]);
    await sqlExecute(`DELETE FROM flatmate_images WHERE post_id = ?`, [row.id]);
    await sqlExecute(`DELETE FROM flatmate_posts WHERE id = ?`, [row.id]);
  }
  const result = await sqlExecute(
    `INSERT INTO flatmate_posts (
      user_id, name, age, gender, profession, budget, bio, flat_address, city, latitude, longitude, phone_number, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
    [
      userId,
      post?.name ?? null,
      post?.age ?? null,
      post?.gender ?? null,
      post?.profession ?? null,
      post?.budget ?? null,
      post?.bio ?? null,
      post?.flatAddress ?? null,
      post?.city ?? null,
      post?.latitude ?? null,
      post?.longitude ?? null,
      post?.phoneNumber ?? null,
    ]
  );
  const postId = result.insertId;
  for (const pref of post?.preferences ?? []) {
    await sqlExecute(`INSERT INTO flatmate_preferences (post_id, preference) VALUES (?, ?)`, [postId, pref]);
  }
  for (const image of post?.images ?? []) {
    await sqlExecute(`INSERT INTO flatmate_images (post_id, image_url) VALUES (?, ?)`, [postId, image]);
  }
  await sqlExecute(`UPDATE users SET display_name = ? WHERE id = ?`, [post?.name ?? null, userId]);
  const rows = await sqlQuery<any>(
    `SELECT id, user_id as userId, name, age, gender, profession, budget, bio, flat_address as flatAddress, city, latitude, longitude, phone_number as phoneNumber, is_active as isActive, created_at as createdAt, updated_at as updatedAt
     FROM flatmate_posts WHERE id = ? LIMIT 1`,
    [postId]
  );
  return (await hydrate(rows))[0];
}

export async function hasActivePost(userId: number): Promise<boolean> {
  const rows = await sqlQuery<any>(
    `SELECT id FROM flatmate_posts WHERE user_id = ? AND is_active = 1 LIMIT 1`,
    [userId]
  );
  return !!rows[0];
}

export async function deleteFlatmatePost(postId: number, userId: number): Promise<boolean> {
  await sqlExecute(`DELETE FROM flatmate_preferences WHERE post_id = ?`, [postId]);
  await sqlExecute(`DELETE FROM flatmate_images WHERE post_id = ?`, [postId]);
  const result = await sqlExecute(`DELETE FROM flatmate_posts WHERE id = ? AND user_id = ?`, [postId, userId]);
  return result.affectedRows > 0;
}
