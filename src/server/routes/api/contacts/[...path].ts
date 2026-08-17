import { defineEventHandler, getMethod, getQuery, getRouterParam, readBody } from 'h3';
import { apiResponse } from '../../utils/api-response';
import { requireAuth } from '../../utils/auth-session';
import { listContactPlans } from '../../config/plans';
import { getWallet, serializeWallet } from '../../services/billing-repository';
import { hasUnlockedListing, unlockListingContact } from '../../services/contact-access-repository';
import { getListingById } from '../../services/listing-repository';

export default defineEventHandler(async (event) => {
  const method = getMethod(event).toUpperCase();
  const path = String(getRouterParam(event, 'path') || '');
  const segments = path.split('/').filter(Boolean);

  if (segments[0] === 'unlock' && method === 'POST') {
    const user = await requireAuth(event);
    const body = await readBody(event);
    const listingId = Number(body?.listingId ?? body?.propertyId);
    if (!Number.isFinite(listingId) || listingId <= 0) {
      return apiResponse(0, 'listingId is required');
    }
    const result = await unlockListingContact(Number(user.id), listingId);
    if (result.code === 'PAYMENT_REQUIRED') {
      return {
        status: 0,
        code: 'PAYMENT_REQUIRED',
        message: result.message,
        data: {
          ...result.data,
          plans: listContactPlans().map((plan) => ({
            code: plan.code,
            name: plan.name,
            amountRupees: Math.round(plan.amountPaise / 100),
            contacts: plan.contacts,
            popular: plan.popular,
            features: plan.features,
            priceLabel: `₹${Math.round(plan.amountPaise / 100)}/month`,
          })),
        },
      };
    }
    return apiResponse(result.status, result.message, result.data);
  }

  if (segments[0] === 'status' && method === 'GET') {
    const user = await requireAuth(event);
    const query = getQuery(event);
    const listingId = Number(query.listingId ?? query.propertyId);
    const wallet = serializeWallet(await getWallet(Number(user.id)));
    if (!Number.isFinite(listingId) || listingId <= 0) {
      return apiResponse(1, 'Wallet status', wallet);
    }
    const listing = await getListingById(listingId);
    const isOwner = listing && Number(listing.ownerId ?? listing.owner_id) === Number(user.id);
    const unlocked = isOwner || (await hasUnlockedListing(Number(user.id), listingId));
    return apiResponse(1, 'Contact status', {
      ...wallet,
      listingId,
      unlocked,
      isOwner: Boolean(isOwner),
    });
  }

  return apiResponse(0, 'Endpoint not implemented');
});
