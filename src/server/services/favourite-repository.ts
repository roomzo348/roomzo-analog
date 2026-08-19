import { sqlExecute, sqlQuery } from '../db/mysql';
import { getListingsByIds } from './listing-repository';
import { getRevealableListingIds } from './contact-access-repository';
import { redactListingContact } from '../utils/contact-access';

export async function addFavourite(userId: number, propertyId: number): Promise<void> {
  await sqlExecute(
    `INSERT INTO favourites (user_id, property_id, created_on)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE created_on = created_on`,
    [userId, propertyId]
  );
}

export async function removeFavourite(userId: number, propertyId: number): Promise<boolean> {
  const result = await sqlExecute(`DELETE FROM favourites WHERE user_id = ? AND property_id = ?`, [
    userId,
    propertyId,
  ]);
  return result.affectedRows > 0;
}

/** Match Java FavouriteService shape: { favouriteId, savedOn, property } */
export async function getFavouritesByUser(userId: number): Promise<any[]> {
  const favRows = await sqlQuery<{
    favouriteId: number;
    propertyId: number;
    savedOn: string;
  }>(
    `SELECT f.id as favouriteId, f.property_id as propertyId, f.created_on as savedOn
     FROM favourites f
     WHERE f.user_id = ?
     ORDER BY f.created_on DESC`,
    [userId]
  );

  if (!favRows.length) return [];

  const propertyIds = favRows.map((row) => Number(row.propertyId));
  const listings = await getListingsByIds(propertyIds);
  const listingById = new Map(listings.map((listing) => [Number(listing.id), listing]));
  // Saving a listing must never reveal the owner's contact. Only a paid
  // unlock on an active plan (or owning the listing) does.
  const revealable = await getRevealableListingIds(userId);

  return favRows
    .map((fav) => {
      const property = listingById.get(Number(fav.propertyId));
      if (!property || Number(property.isRented) === 2) return null;
      const listingId = Number(property.id);
      const isOwner = Number(property.ownerId ?? property.owner_id) === Number(userId);
      return {
        favouriteId: fav.favouriteId,
        savedOn: fav.savedOn,
        property: redactListingContact(property, isOwner || revealable.has(listingId)),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);
}
