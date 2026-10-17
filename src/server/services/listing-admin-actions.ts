import { createError } from 'h3';
import {
  getListingById,
  setListingModeration,
} from './listing-repository';
import { creditListingRewardOnce } from './listing-reward';
import { emailListingApproved, emailListingDuplicate, emailListingRejected } from './listing-moderation-mail';
import { notifyNewProperty } from './onesignal.service';
import { getUserById } from './auth-repository';

async function resolveOwnerEmail(listing: any): Promise<string | null> {
  if (listing?.ownerEmail) return String(listing.ownerEmail);
  const ownerId = Number(listing?.ownerId ?? listing?.owner_id);
  if (!ownerId) return null;
  const user = await getUserById(ownerId);
  return user?.email ?? null;
}

export async function approveQueuedListing(listingId: number) {
  const listing = await getListingById(listingId);
  if (!listing) {
    throw createError({ statusCode: 404, statusMessage: 'Listing not found' });
  }

  const ownerId = Number(listing.ownerId ?? listing.owner_id);
  if (!Number.isFinite(ownerId) || ownerId <= 0) {
    throw createError({ statusCode: 500, statusMessage: 'Listing has no owner to credit' });
  }

  const updated = await setListingModeration(listingId, 'approved', null);
  if (!updated) {
    throw createError({ statusCode: 500, statusMessage: 'Could not mark listing approved' });
  }

  const reward = await creditListingRewardOnce(listingId, ownerId);

  const live = await getListingById(listingId);
  try {
    await notifyNewProperty(listingId, live?.propertyName ?? listing.propertyName ?? 'New listing');
  } catch (error) {
    console.error('[admin] notify failed', error);
  }

  await emailListingApproved(await resolveOwnerEmail(listing), {
    propertyName: live?.propertyName ?? listing.propertyName,
    listingId,
    credited: reward.credited,
    credits: reward.credits,
  });

  return {
    listing: live,
    credited: reward.credited,
    credits: reward.credits,
    moderationStatus: live?.moderationStatus ?? 'approved',
  };
}

export async function rejectQueuedListing(listingId: number, rawReason: string) {
  const listing = await getListingById(listingId);
  if (!listing) {
    throw createError({ statusCode: 404, statusMessage: 'Listing not found' });
  }
  const reason = rawReason === 'duplicate' ? 'duplicate' : 'not_legit';
  const updated = await setListingModeration(listingId, 'rejected', reason);
  if (!updated) {
    throw createError({ statusCode: 500, statusMessage: 'Could not reject listing' });
  }
  const ownerEmail = await resolveOwnerEmail(listing);
  if (reason === 'duplicate') {
    await emailListingDuplicate(ownerEmail, listing.propertyName);
  } else {
    await emailListingRejected(ownerEmail, { propertyName: listing.propertyName, reason });
  }
  return { listingId, reason };
}
