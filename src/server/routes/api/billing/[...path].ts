import { createError, defineEventHandler, getHeader, getMethod, getRouterParam, readBody, readRawBody } from 'h3';
import { listContactPlans, getContactPlan, FREE_OWNER_CONTACTS } from '../../../config/plans';
import { apiResponse } from '../../../utils/api-response';
import { requireAuth } from '../../../utils/auth-session';
import { getServerRuntime } from '../../../utils/runtime-config';
import {
  isFailedCashfreePaymentStatus,
  isPaidCashfreeOrderStatus,
  verifyCashfreeWebhookSignature,
} from '../../../utils/cashfree-signature';
import {
  createCashfreeOrder,
  fetchCashfreeOrder,
  getCashfreeConfig,
  isPaidCashfreeOrder,
  resolveCashfreePaymentId,
} from '../../../services/cashfree.service';
import {
  createPendingPayment,
  fulfillPaidOrder,
  getPaymentByOrderId,
  getWallet,
  markPaymentFailed,
  reconcilePendingPaymentsForUser,
  serializeWallet,
} from '../../../services/billing-repository';
import { getUnlockedListingIds } from '../../../services/contact-access-repository';
import { notifyPaidSubscription } from '../../../services/subscription-alert';

function publicPlans() {
  return listContactPlans(getServerRuntime().contactPlansJson).map((plan) => ({
    code: plan.code,
    name: plan.name,
    tagline: plan.tagline,
    amountPaise: plan.amountPaise,
    amountRupees: Math.round(plan.amountPaise / 100),
    originalAmountRupees: plan.originalAmountRupees,
    offerLabel: plan.offerLabel,
    currency: plan.currency,
    contacts: plan.contacts,
    durationDays: plan.durationDays,
    popular: plan.popular,
    features: plan.features,
    priceLabel: `₹${Math.round(plan.amountPaise / 100)}/month`,
  }));
}

function siteOrigin(): string {
  return String(getServerRuntime().siteUrl || 'https://www.roomzo.in').replace(/\/$/, '');
}

export default defineEventHandler(async (event) => {
  const method = getMethod(event).toUpperCase();
  const path = String(getRouterParam(event, 'path') || '');
  const segments = path.split('/').filter(Boolean);

  if (segments[0] === 'plans' && method === 'GET') {
    return apiResponse(1, 'Plans fetched', {
      freeOwnerContacts: FREE_OWNER_CONTACTS,
      plans: publicPlans(),
    });
  }

  if (segments[0] === 'config' && method === 'GET') {
    const cfg = getCashfreeConfig();
    return apiResponse(1, 'Billing config', {
      configured: cfg.configured,
      mode: cfg.mode === 'unset' ? 'unset' : cfg.mode === 'production' ? 'production' : 'sandbox',
      provider: 'cashfree',
    });
  }

  if (segments[0] === 'me' && method === 'GET') {
    const user = await requireAuth(event);
    const userId = Number(user.id);
    // Recover credits when verify failed but Cashfree already marked the order PAID.
    await reconcilePendingPaymentsForUser(userId).catch(() => undefined);
    const wallet = await getWallet(userId);
    const unlockedListingIds = await getUnlockedListingIds(userId);
    return apiResponse(1, 'Wallet fetched', {
      ...serializeWallet(wallet),
      unlockedListingIds,
      plans: publicPlans(),
    });
  }

  if (segments[0] === 'orders' && method === 'POST') {
    const user = await requireAuth(event);
    const cfg = getCashfreeConfig();
    if (!cfg.configured) {
      return apiResponse(
        0,
        'Cashfree keys are not configured yet. Add CASHFREE_APP_ID and CASHFREE_SECRET_KEY.'
      );
    }
    const body = await readBody(event);
    const plan = getContactPlan(
      String(body?.planCode || body?.plan || ''),
      getServerRuntime().contactPlansJson
    );
    if (!plan) return apiResponse(0, 'Choose Starter, Plus, or Pro to continue');

    const orderId = `rz${plan.code}${user.id}${Date.now()}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
    const origin = siteOrigin();
    const returnUrl = `${origin}/pricing?payment=success&order_id={order_id}`;
    const notifyUrl = `${origin}/api/billing/webhook`;

    const order = await createCashfreeOrder({
      orderId,
      amountRupees: Math.round(plan.amountPaise / 100),
      currency: plan.currency,
      customerId: `user_${user.id}`,
      customerName: user.displayName || user.name || 'Roomzo User',
      customerEmail: user.email || undefined,
      customerPhone: user.phone || undefined,
      orderNote: `${plan.code}:${plan.contacts}`,
      returnUrl,
      notifyUrl,
    });

    if (!order.payment_session_id) {
      return apiResponse(0, 'Cashfree did not return a payment session. Try again.');
    }

    await createPendingPayment({
      userId: Number(user.id),
      plan,
      orderId: order.order_id || orderId,
    });

    return apiResponse(1, 'Order created', {
      orderId: order.order_id || orderId,
      paymentSessionId: order.payment_session_id,
      amount: plan.amountPaise,
      amountRupees: Math.round(plan.amountPaise / 100),
      currency: plan.currency,
      mode: cfg.mode === 'production' ? 'production' : 'sandbox',
      provider: 'cashfree',
      plan: {
        code: plan.code,
        name: plan.name,
        contacts: plan.contacts,
        priceLabel: `₹${Math.round(plan.amountPaise / 100)}/month`,
      },
      prefill: {
        name: user.displayName || user.name || '',
        email: user.email || '',
        contact: user.phone || '',
      },
    });
  }

  if (segments[0] === 'verify' && method === 'POST') {
    const user = await requireAuth(event);
    const cfg = getCashfreeConfig();
    if (!cfg.configured) return apiResponse(0, 'Cashfree is not configured');
    const body = await readBody(event);
    const orderId = String(body?.orderId || body?.order_id || '');
    if (!orderId) {
      return apiResponse(0, 'Missing Cashfree order id');
    }

    const payment = await getPaymentByOrderId(orderId);
    if (!payment || Number(payment.user_id) !== Number(user.id)) {
      return apiResponse(0, 'Order not found for this account');
    }

    let remoteOrder: Awaited<ReturnType<typeof fetchCashfreeOrder>> | null = null;
    try {
      remoteOrder = await fetchCashfreeOrder(orderId);
    } catch {
      remoteOrder = null;
    }

    if (!remoteOrder) {
      return apiResponse(0, 'Could not confirm payment with Cashfree. Credits were not granted.');
    }

    const expectedRupees = Number(payment.amount_paise) / 100;
    if (
      Number.isFinite(remoteOrder.order_amount) &&
      Math.abs(Number(remoteOrder.order_amount) - expectedRupees) > 0.01
    ) {
      return apiResponse(0, 'Payment amount mismatch');
    }

    if (!isPaidCashfreeOrder(remoteOrder.order_status)) {
      const status = String(remoteOrder.order_status || '').toUpperCase();
      if (status === 'EXPIRED' || status === 'TERMINATED') {
        await markPaymentFailed(orderId);
        return apiResponse(0, 'Payment failed. No credits were added.');
      }
      return apiResponse(0, 'Payment is not complete yet. If money was deducted, refresh your profile in a minute.');
    }

    const paymentId =
      String(body?.paymentId || body?.cf_payment_id || '') ||
      (await resolveCashfreePaymentId(orderId)) ||
      `cf_${orderId}`;

    const fulfilled = await fulfillPaidOrder({ orderId, paymentId, signature: null });
    await notifyPaidSubscription({
      alreadyPaid: fulfilled.alreadyPaid,
      userId: Number(payment.user_id),
      planName: fulfilled.plan?.name,
      planCode: fulfilled.plan?.code || payment.plan_code,
      contacts: fulfilled.plan?.contacts,
      amountPaise: payment.amount_paise,
      creditsRemaining: fulfilled.wallet.creditsRemaining,
      orderId,
      paymentId,
      userHint: { name: user.displayName || user.name, email: user.email, phone: user.phone },
    });
    return apiResponse(1, fulfilled.alreadyPaid ? 'Payment already captured' : 'Payment successful', {
      ...serializeWallet(fulfilled.wallet),
      plan: fulfilled.plan
        ? { code: fulfilled.plan.code, name: fulfilled.plan.name, contacts: fulfilled.plan.contacts }
        : null,
    });
  }

  if (segments[0] === 'webhook' && method === 'POST') {
    const cfg = getCashfreeConfig();
    const rawBody = (await readRawBody(event)) || '';
    const signature = String(getHeader(event, 'x-webhook-signature') || '');
    const timestamp = String(getHeader(event, 'x-webhook-timestamp') || '');

    if (!cfg.configured) {
      return { status: 'ignored', reason: 'Cashfree is not configured' };
    }
    if (
      !verifyCashfreeWebhookSignature({
        rawBody: String(rawBody),
        signature,
        timestamp,
        secretKey: cfg.secretKey,
      })
    ) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid webhook signature' });
    }

    const payload = rawBody ? JSON.parse(String(rawBody)) : await readBody(event);
    const eventType = String(payload?.type || payload?.event || '').toUpperCase();
    const data = payload?.data || {};
    const order = data?.order || {};
    const paymentEntity = data?.payment || {};
    const orderId = String(order?.order_id || data?.order_id || '');
    const paymentId = String(
      paymentEntity?.cf_payment_id || paymentEntity?.payment_id || data?.cf_payment_id || ''
    );
    const paymentStatus = String(paymentEntity?.payment_status || data?.payment_status || '');
    const orderStatus = String(order?.order_status || data?.order_status || '');

    if (!orderId) {
      return { status: 'ignored', reason: 'missing order id' };
    }

    const successEvent =
      eventType.includes('PAYMENT_SUCCESS') ||
      eventType.includes('ORDER_PAID') ||
      isPaidCashfreeOrderStatus(orderStatus) ||
      paymentStatus.toUpperCase() === 'SUCCESS';

    const failedEvent =
      eventType.includes('PAYMENT_FAILED') ||
      eventType.includes('PAYMENT_USER_DROPPED') ||
      isFailedCashfreePaymentStatus(paymentStatus);

    if (successEvent) {
      const existing = await getPaymentByOrderId(orderId);
      if (existing && existing.status !== 'paid') {
        try {
          const remote = await fetchCashfreeOrder(orderId);
          if (!isPaidCashfreeOrder(remote.order_status)) {
            return { status: 'ignored', reason: 'order not paid yet' };
          }
          const expectedRupees = Number(existing.amount_paise) / 100;
          if (
            Number.isFinite(remote.order_amount) &&
            Math.abs(Number(remote.order_amount) - expectedRupees) > 0.01
          ) {
            return { status: 'ignored', reason: 'amount mismatch' };
          }
        } catch {
          return { status: 'ignored', reason: 'could not confirm payment' };
        }

        const capturedId = paymentId || (await resolveCashfreePaymentId(orderId)) || `cf_${orderId}`;
        const fulfilled = await fulfillPaidOrder({
          orderId,
          paymentId: capturedId,
          signature,
        });
        await notifyPaidSubscription({
          alreadyPaid: fulfilled.alreadyPaid,
          userId: Number(existing.user_id),
          planName: fulfilled.plan?.name,
          planCode: fulfilled.plan?.code || existing.plan_code,
          contacts: fulfilled.plan?.contacts,
          amountPaise: existing.amount_paise,
          creditsRemaining: fulfilled.wallet.creditsRemaining,
          orderId,
          paymentId: capturedId,
        });
      }
    }

    if (failedEvent) {
      await markPaymentFailed(orderId, paymentId || undefined);
    }

    return { status: 'ok' };
  }

  return apiResponse(0, 'Endpoint not implemented');
});
