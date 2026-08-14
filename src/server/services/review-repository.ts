import { sqlExecute, sqlQuery } from '../db/mysql';

export async function getListingReviews(listingId: number): Promise<{
  reviews: any[];
  avgRating: number;
  reviewCount: number;
}> {
  const reviews = await sqlQuery<any>(
    `SELECT id, listing_id as listingId, user_id as userId, reviewer_name as reviewerName, rating, comment, created_on as createdOn
     FROM property_reviews
     WHERE listing_id = ?
     ORDER BY created_on DESC`,
    [listingId]
  );
  const agg = await sqlQuery<{ avgRating: number; reviewCount: number }>(
    `SELECT COALESCE(AVG(rating), 0) as avgRating, COUNT(*) as reviewCount
     FROM property_reviews WHERE listing_id = ?`,
    [listingId]
  );
  return {
    reviews,
    avgRating: Number(agg[0]?.avgRating ?? 0),
    reviewCount: Number(agg[0]?.reviewCount ?? 0),
  };
}

export async function upsertReview(
  listingId: number,
  userId: number,
  rating: number,
  comment: string | null
): Promise<void> {
  const userRows = await sqlQuery<{ name: string | null }>(`SELECT name FROM users WHERE id = ? LIMIT 1`, [userId]);
  const reviewerName = userRows[0]?.name ?? 'User';

  await sqlExecute(
    `INSERT INTO property_reviews (listing_id, user_id, reviewer_name, rating, comment, created_on)
     VALUES (?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       reviewer_name = VALUES(reviewer_name),
       rating = VALUES(rating),
       comment = VALUES(comment),
       created_on = NOW()`,
    [listingId, userId, reviewerName, rating, comment]
  );

  const stats = await sqlQuery<{ avgRating: number; reviewCount: number }>(
    `SELECT COALESCE(AVG(rating), 0) as avgRating, COUNT(*) as reviewCount
     FROM property_reviews WHERE listing_id = ?`,
    [listingId]
  );

  await sqlExecute(
    `UPDATE property_listings
     SET avg_rating = ?, review_count = ?
     WHERE id = ?`,
    [Number(stats[0]?.avgRating ?? 0), Number(stats[0]?.reviewCount ?? 0), listingId]
  );
}
