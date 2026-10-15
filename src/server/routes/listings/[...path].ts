import {
  defineEventHandler,
  createError,
  getMethod,
  getQuery,
  getRouterParam,
  readBody,
} from 'h3';
import {
  createListing,
  deleteListing,
  getFeaturedListings,
  getListingById,
  getOwnerListings,
  getOwnerName,
  getRecentListings,
  isListingApproved,
  searchListings,
  setListingStatus,
  updateListing,
} from '../../services/listing-repository';
import { findListingDuplicates } from '../../services/listing-duplicate';
import {
  duplicateSubmitMessage,
  emailAdminListingPending,
  emailListingDuplicate,
} from '../../services/listing-moderation-mail';
import { notifyNewProperty } from '../../services/onesignal.service';
import { getListingReviews, upsertReview } from '../../services/review-repository';
import { apiListResponse, apiResponse } from '../../utils/api-response';
import { isAdminUser } from '../../utils/admin';
import { getAuthUser, requireAuth } from '../../utils/auth-session';
import { redactListingContact } from '../../utils/contact-access';
import { canRevealContact } from '../../services/contact-access-repository';

function parseIntSafe(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function hideListingContacts<T extends Record<string, unknown>>(listings: T[]): Array<T & { contactUnlocked: boolean }> {
  return listings.map((listing) => redactListingContact(listing, false));
}

async function listingForViewer(listing: any, user: any | null): Promise<any> {
  if (!listing) return listing;
  try {
    const ownerId = Number(listing.ownerId ?? listing.owner_id);
    if (user && Number(user.id) === ownerId) {
      return redactListingContact(listing, true);
    }
    if (user && (await canRevealContact(Number(user.id), Number(listing.id)))) {
      return redactListingContact(listing, true);
    }
  } catch {
    return redactListingContact(listing, false);
  }
  return redactListingContact(listing, false);
}

async function assertListingOwner(listingId: number, userId: number): Promise<void> {
  const listing = await getListingById(listingId);
  if (!listing || Number(listing.ownerId) !== Number(userId)) {
    throw createError({ statusCode: 403, statusMessage: 'Not allowed to modify this listing' });
  }
}

export default defineEventHandler(async (event) => {
  try {
    const method = getMethod(event).toUpperCase();
    const path = String(getRouterParam(event, 'path') || '');
    const segments = path.split('/').filter(Boolean);
    const query = getQuery(event);

  if (segments[0] === 'add' && method === 'POST') {
    const user = await requireAuth(event);
    const payload = await readBody(event);
    const photos = Array.isArray(payload?.photos) ? payload.photos.filter(Boolean) : [];
    if (photos.length < 2) {
      throw createError({
        statusCode: 400,
        statusMessage: 'At least 2 uploaded photos are required. Listing was not created.',
      });
    }
    const details = payload?.details ?? {};
    const address = details?.address ?? {};
    const finalInfo = payload?.final ?? {};
    const directPublish = Boolean(payload?.directPublish) && isAdminUser(user);
    const listingIntent = directPublish
      ? 'direct'
      : payload?.listingIntent === 'reward'
        ? 'reward'
        : 'owner';
    const waitForApproval = listingIntent === 'reward';

    const duplicate = await findListingDuplicates({
      city: address?.city,
      street: address?.street,
      landmark: address?.landmark,
      zone: address?.zone,
      propertyName: details?.propertyName ?? finalInfo?.name,
      bedrooms: details?.bedrooms,
      rentAmount: finalInfo?.rentAmount,
      latitude: address?.latitude,
      longitude: address?.longitude,
      phone: finalInfo?.contactNo,
    });
    if (duplicate.kind === 'hard') {
      await emailListingDuplicate(user.email, details?.propertyName ?? finalInfo?.name);
      throw createError({
        statusCode: 409,
        statusMessage: duplicateSubmitMessage(),
      });
    }

    const listingId = await createListing(
      { ...payload, photos, ownerId: user.id },
      {
        moderationStatus: waitForApproval ? 'pending' : 'approved',
        duplicateOfListingId: duplicate.matchId ?? null,
        duplicateFlag: duplicate.kind === 'soft' ? duplicate.reason ?? 'possible' : null,
        listingIntent,
      }
    );
    const listing = await getListingById(listingId);

    if (waitForApproval) {
      await emailAdminListingPending({
        listingId,
        propertyName: listing?.propertyName ?? details?.propertyName ?? finalInfo?.name,
        city: listing?.city ?? address?.city,
        state: listing?.state ?? address?.state,
        rentAmount: listing?.rentAmount ?? finalInfo?.rentAmount,
        ownerName: user?.name ?? user?.displayName,
        ownerEmail: user?.email,
        ownerPhone: user?.phone ?? finalInfo?.contactNo,
        duplicateFlag: listing?.duplicateFlag ?? listing?.duplicate_flag,
      });
      return {
        status: 1,
        message:
          'Listing submitted for review. It will go live after Roomzo approval. Contact points are added only after approval.',
        data: { listingId, listing, pending: true },
      };
    }

    await notifyNewProperty(listingId, listing?.propertyName ?? 'New listing');
    return { status: 1, message: 'Listing added successfully', data: { listingId, listing, pending: false } };
  }

  if (segments[0] === 'all' && method === 'GET') {
    const result = await searchListings({
      page: parseIntSafe(query.page, 0),
      size: parseIntSafe(query.size, 6),
      isRented: query.isRented == null ? undefined : Number(query.isRented),
      sortBy: 'latest',
    });
    return apiListResponse(hideListingContacts(result.listings), result);
  }

  if (segments[0] === 'search' && method === 'GET') {
    const result = await searchListings({
      page: parseIntSafe(query.page, 0),
      size: parseIntSafe(query.size, 6),
      state: query.state ? String(query.state) : undefined,
      city: query.city ? String(query.city) : undefined,
      isRented: query.isRented == null ? undefined : Number(query.isRented),
      minPrice: query.minPrice == null ? undefined : Number(query.minPrice),
      maxPrice: query.maxPrice == null ? undefined : Number(query.maxPrice),
      propertyType: query.propertyType ? String(query.propertyType) : undefined,
      bedrooms: query.bedrooms == null ? undefined : Number(query.bedrooms),
      sortBy: 'latest',
    });
    return apiListResponse(hideListingContacts(result.listings), result);
  }

  if (segments[0] === 'allWithFilters' && method === 'GET') {
    const result = await searchListings({
      page: parseIntSafe(query.page, 0),
      size: parseIntSafe(query.size, 6),
      isRented: query.isRented == null ? undefined : Number(query.isRented),
      minPrice: query.minPrice == null ? undefined : Number(query.minPrice),
      maxPrice: query.maxPrice == null ? undefined : Number(query.maxPrice),
      propertyType: query.propertyType ? String(query.propertyType) : undefined,
      bedrooms: query.bedrooms == null ? undefined : Number(query.bedrooms),
      sortBy: String(query.sortBy || 'latest'),
    });
    return apiListResponse(hideListingContacts(result.listings), result);
  }

  if (segments[0] === 'searchWithFilters' && method === 'GET') {
    const result = await searchListings({
      page: parseIntSafe(query.page, 0),
      size: parseIntSafe(query.size, 6),
      isRented: query.isRented == null ? undefined : Number(query.isRented),
      minPrice: query.minPrice == null ? undefined : Number(query.minPrice),
      maxPrice: query.maxPrice == null ? undefined : Number(query.maxPrice),
      propertyType: query.propertyType ? String(query.propertyType) : undefined,
      bedrooms: query.bedrooms == null ? undefined : Number(query.bedrooms),
      lat: query.lat == null ? undefined : Number(query.lat),
      lng: query.lng == null ? undefined : Number(query.lng),
      city: query.city ? String(query.city) : undefined,
      state: query.state ? String(query.state) : undefined,
      zone: query.zone ? String(query.zone) : undefined,
      sortBy: String(query.sortBy || 'latest'),
    });
    return apiListResponse(hideListingContacts(result.listings), result);
  }

  if (segments[0] === 'recent' && method === 'GET') {
    const limit = parseIntSafe(query.limit, 10);
    const listings = await getRecentListings(limit);
    return {
      status: 1,
      message: 'Recent listings fetched successfully',
      listings: hideListingContacts(listings),
      currentPage: 0,
      totalPages: 1,
      totalItems: listings.length,
    };
  }

  if (segments[0] === 'featured' && method === 'GET') {
    const limit = parseIntSafe(query.limit, 10);
    const listings = await getFeaturedListings(limit);
    return {
      status: 1,
      message: 'Featured listings fetched successfully',
      listings: hideListingContacts(listings),
      currentPage: 0,
      totalPages: 1,
      totalItems: listings.length,
    };
  }

  if (segments[0] === 'exploreCity' && method === 'GET') {
    const result = await searchListings({
      page: parseIntSafe(query.page, 0),
      size: parseIntSafe(query.size, 6),
      city: query.city ? String(query.city) : undefined,
      state: query.state ? String(query.state) : undefined,
      zone: query.zone ? String(query.zone) : undefined,
      propertyType: query.propertyType ? String(query.propertyType) : undefined,
      sortBy: String(query.sortBy || 'latest'),
    });
    return apiListResponse(hideListingContacts(result.listings), result);
  }

  if (segments[0] === 'owner' && segments[1] && method === 'GET') {
    const user = await requireAuth(event);
    const ownerId = Number(segments[1]);
    if (Number(user.id) !== ownerId) {
      return apiResponse(0, 'Forbidden', []);
    }
    const data = await getOwnerListings(ownerId);
    return apiResponse(1, 'Owner listings fetched successfully', data);
  }

  if (segments.length === 2 && segments[1] === 'status' && method === 'PATCH') {
    const user = await requireAuth(event);
    const listingId = Number(segments[0]);
    await assertListingOwner(listingId, user.id);
    const status = Number(query.status);
    const ok = await setListingStatus(listingId, status);
    return apiResponse(ok ? 1 : 0, ok ? 'Status updated successfully' : 'Listing not found');
  }

  if (segments[0] === 'delete' && segments[1] && method === 'DELETE') {
    const user = await requireAuth(event);
    const listingId = Number(segments[1]);
    await assertListingOwner(listingId, user.id);
    const ok = await deleteListing(listingId);
    return apiResponse(ok ? 1 : 0, ok ? 'Listing deleted successfully' : 'Listing not found');
  }

  if (segments[0] === 'update' && segments[1] && method === 'PUT') {
    const user = await requireAuth(event);
    const listingId = Number(segments[1]);
    await assertListingOwner(listingId, user.id);
    const payload = await readBody(event);
    const ok = await updateListing(listingId, payload);
    const listing = ok ? await getListingById(listingId) : null;
    return apiResponse(ok ? 1 : 0, ok ? 'Listing updated successfully' : 'Listing not found', listing);
  }

  if (segments.length === 2 && segments[1] === 'reviews' && method === 'GET') {
    const listingId = Number(segments[0]);
    const data = await getListingReviews(listingId);
    return { status: 1, ...data };
  }

  if (segments.length === 2 && segments[1] === 'reviews' && method === 'POST') {
    const user = await requireAuth(event);
    const listingId = Number(segments[0]);
    const payload = await readBody(event);
    await upsertReview(
      listingId,
      Number(user.id),
      Number(payload?.rating),
      payload?.comment ? String(payload.comment) : null
    );
    return apiResponse(1, 'Review submitted successfully');
  }

  if (segments.length === 1 && method === 'GET') {
    const listingId = Number(segments[0]);
    const listing = await getListingById(listingId);
    if (!listing) {
      return apiResponse(0, 'Listing not found', null);
    }
    const viewer = await getAuthUser(event);
    const ownerId = Number(listing.ownerId ?? listing.owner_id);
    const canViewPending =
      Boolean(viewer && Number(viewer.id) === ownerId) || isAdminUser(viewer);
    if (!isListingApproved(listing) && !canViewPending) {
      return apiResponse(0, 'Listing not found', null);
    }
    const ownerName = await getOwnerName(listing.owner_id ?? listing.ownerId);
    return {
      status: 1,
      message: 'Property fetched successfully',
      ownerName: ownerName ?? 'Property Owner',
      data: await listingForViewer(listing, viewer),
    };
  }

    return apiResponse(0, 'Endpoint not implemented');
  } catch (error: any) {
    if (error?.statusCode === 401 || error?.statusCode === 403 || error?.statusCode === 409 || error?.statusCode === 400) {
      throw error;
    }
    return apiResponse(-1, error?.message || 'Failed to fetch listings');
  }
});
