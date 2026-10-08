import { sqlExecute, sqlQuery } from '../db/mysql';
import { getFlatmatePostsByIds } from './flatmate-repository';

let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await sqlExecute(`
    CREATE TABLE IF NOT EXISTS flatmate_favourites (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      post_id INT NOT NULL,
      created_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_flatmate (user_id, post_id),
      KEY idx_user (user_id),
      KEY idx_post (post_id)
    )
  `);
  tableReady = true;
}

export async function addFlatmateFavourite(userId: number, postId: number): Promise<void> {
  await ensureTable();
  await sqlExecute(
    `INSERT INTO flatmate_favourites (user_id, post_id, created_on)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE created_on = created_on`,
    [userId, postId]
  );
}

export async function removeFlatmateFavourite(userId: number, postId: number): Promise<boolean> {
  await ensureTable();
  const result = await sqlExecute(
    `DELETE FROM flatmate_favourites WHERE user_id = ? AND post_id = ?`,
    [userId, postId]
  );
  return result.affectedRows > 0;
}

export async function getFlatmateFavouritesByUser(userId: number): Promise<any[]> {
  await ensureTable();
  const favRows = await sqlQuery<{
    favouriteId: number;
    postId: number;
    savedOn: string;
  }>(
    `SELECT id as favouriteId, post_id as postId, created_on as savedOn
     FROM flatmate_favourites
     WHERE user_id = ?
     ORDER BY created_on DESC`,
    [userId]
  );

  if (!favRows.length) return [];

  const posts = await getFlatmatePostsByIds(favRows.map((row) => Number(row.postId)));
  const postById = new Map(posts.map((post) => [Number(post.id), post]));

  return favRows
    .map((fav) => {
      const flatmate = postById.get(Number(fav.postId));
      if (!flatmate) return null;
      return {
        favouriteId: fav.favouriteId,
        savedOn: fav.savedOn,
        type: 'flatmate',
        flatmate,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);
}