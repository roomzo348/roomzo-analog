import { defineEventHandler, createError, getMethod, getQuery, getRouterParam, readBody } from 'h3';
import {
  getListingById,
  listModerationQueue,
  setListingModeration,
} from '../../../../services/listing-repository';
import { creditListingRewardOnce } from '../../../../services/listing-reward';
import {
  emailListingApproved,
  emailListingDuplicate,
  emailListingRejected,
} from '../../../../services/listing-moderation-mail';
import { notifyNewProperty } from '../../../../services/onesignal.service';
import { getUserById } from '../../../../services/auth-repository';
import { apiResponse } from '../../../../utils/api-response';
import { requireAdmin } from '../../../../utils/admin';

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event);
    const method = getMethod(event).toUpperCase();
    const path = String(getRouterParam(event, 'path') || '');
    const segments = path.split('/').filter(Boolean);
    const query = getQuery(event);

    if (segments.length === 0 && method === 'GET') {
      const status = String(query.status || 'pending');
      const listings = await listModerationQueue(status);
      return apiResponse(1, 'ok', listings);
    }

    if (segments.length === 2 && method === 'POST' && segments[1] === 'approve') {
      const listingId = Number(segments[0]);
      const listing = await getListingById(listingId);
      if (!listing) {
        throw createError({ statusCode: 404, statusMessage: 'Listing not found' });
      }
      await setListingModeration(listingId, 'approved', null);
      const ownerId = Number(listing.ownerId ?? listing.owner_id);
      const wantsPoints = (listing.listingIntent ?? listing.listing_intent) === 'reward';
      const reward = wantsPoints
        ? await creditListingRewardOnce(listingId, ownerId)
        : { credited: false, credits: 0 };
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
      });
      return apiResponse(1, 'Listing approved', {
        listing: live,
        credited: reward.credited,
        credits: reward.credits,
        adminId: admin.id,
      });
    }

    if (segments.length === 2 && method === 'POST' && segments[1] === 'reject') {
      const listingId = Number(segments[0]);
      const listing = await getListingById(listingId);
      if (!listing) {
        throw createError({ statusCode: 404, statusMessage: 'Listing not found' });
      }
      const body = await readBody(event).catch(() => ({}));
      const reason = String(body?.reason || 'not_legit') === 'duplicate' ? 'duplicate' : 'not_legit';
      await setListingModeration(listingId, 'rejected', reason);
      const ownerEmail = await resolveOwnerEmail(listing);
      if (reason === 'duplicate') {
        await emailListingDuplicate(ownerEmail, listing.propertyName);
      } else {
        await emailListingRejected(ownerEmail, { propertyName: listing.propertyName, reason });
      }
      return apiResponse(1, 'Listing rejected', { listingId, reason });
    }

    return apiResponse(0, 'Endpoint not implemented');
  } catch (error: any) {
    if (error?.statusCode === 401 || error?.statusCode === 403 || error?.statusCode === 404) {
      throw error;
    }
    return apiResponse(-1, error?.message || 'Admin listings failed');
  }
});

async function resolveOwnerEmail(listing: any): Promise<string | null> {
  if (listing?.ownerEmail) return String(listing.ownerEmail);
  const ownerId = Number(listing?.ownerId ?? listing?.owner_id);
  if (!ownerId) return null;
  const user = await getUserById(ownerId);
  return user?.email ?? null;
}
