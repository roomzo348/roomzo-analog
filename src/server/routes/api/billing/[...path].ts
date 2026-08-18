import { createError, defineEventHandler, getHeader, getMethod, getRouterParam, readBody, readRawBody } from 'h3';
import { listContactPlans, getContactPlan } from '../../../config/plans';
import { apiResponse } from '../../../utils/api-response';
import { requireAuth } from '../../../utils/auth-session';
import { verifyCheckoutSignature, verifyWebhookSignature, isCapturedRazorpayPayment } from '../../../utils/razorpay-signature';
import {
  createRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpayConfig,
} from '../../../services/razorpay.service';
import {
  createPendingPayment,
  fulfillPaidOrder,
  getPaymentByOrderId,
  getWallet,
  markPaymentFailed,
  serializeWallet,
} from '../../../services/billing-repository';
import { getUnlockedListingIds } from '../../../services/contact-access-repository';
import { notifyPaidSubscription } from '../../../services/subscription-alert';

function publicPlans() {
  return listContactPlans().map((plan) => ({
    code: plan.code,
    name: plan.name,
    tagline: plan.tagline,
    amountPaise: plan.amountPaise,
    amountRupees: Math.round(plan.amountPaise / 100),
    currency: plan.currency,
    contacts: plan.contacts,
    durationDays: plan.durationDays,
    popular: plan.popular,
    features: plan.features,
    priceLabel: `₹${Math.round(plan.amountPaise / 100)}/month`,
  }));
}

export default defineEventHandler(async (event) => {
  const method = getMethod(event).toUpperCase();
  const path = String(getRouterParam(event, 'path') || '');
  const segments = path.split('/').filter(Boolean);

  if (segments[0] === 'plans' && method === 'GET') {
    return apiResponse(1, 'Plans fetched', {
      freeOwnerContacts: 1,
      plans: publicPlans(),
    });
  }

  if (segments[0] === 'config' && method === 'GET') {
    const cfg = getRazorpayConfig();
    return apiResponse(1, 'Billing config', {
      keyId: cfg.keyId,
      configured: cfg.configured,
      mode: cfg.mode,
    });
  }

  if (segments[0] === 'me' && method === 'GET') {
    const user = await requireAuth(event);
    const wallet = await getWallet(Number(user.id));
    const unlockedListingIds = await getUnlockedListingIds(Number(user.id));
    return apiResponse(1, 'Wallet fetched', {
      ...serializeWallet(wallet),
      unlockedListingIds,
      plans: publicPlans(),
    });
  }

  if (segments[0] === 'orders' && method === 'POST') {
    const user = await requireAuth(event);
    const cfg = getRazorpayConfig();
    if (!cfg.configured) {
      return apiResponse(0, 'Razorpay sandbox keys are not configured yet. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    }
    const body = await readBody(event);
    const plan = getContactPlan(String(body?.planCode || body?.plan || ''));
    if (!plan) return apiResponse(0, 'Choose Starter, Plus, or Pro to continue');

    const receipt = `rz${plan.code}${user.id}${Date.now()}`.slice(0, 40);
    const order = await createRazorpayOrder({
      amountPaise: plan.amountPaise,
      currency: plan.currency,
      receipt,
      notes: {
        userId: String(user.id),
        planCode: plan.code,
        contacts: String(plan.contacts),
      },
    });
    await createPendingPayment({
      userId: Number(user.id),
      plan,
      razorpayOrderId: order.id,
    });
    return apiResponse(1, 'Order created', {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: cfg.keyId,
      mode: cfg.mode,
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
    const cfg = getRazorpayConfig();
    if (!cfg.configured) return apiResponse(0, 'Razorpay is not configured');
    const body = await readBody(event);
    const orderId = String(body?.razorpay_order_id || body?.orderId || '');
    const paymentId = String(body?.razorpay_payment_id || body?.paymentId || '');
    const signature = String(body?.razorpay_signature || body?.signature || '');
    if (!orderId || !paymentId || !signature) {
      return apiResponse(0, 'Missing Razorpay payment details');
    }

    const payment = await getPaymentByOrderId(orderId);
    if (!payment || Number(payment.user_id) !== Number(user.id)) {
      return apiResponse(0, 'Order not found for this account');
    }
    if (!verifyCheckoutSignature({ orderId, paymentId, signature, keySecret: cfg.keySecret })) {
      return apiResponse(0, 'Payment signature verification failed');
    }

    let remotePayment: { id: string; status: string; amount: number; currency: string; order_id?: string };
    try {
      remotePayment = await fetchRazorpayPayment(paymentId);
    } catch {
      return apiResponse(0, 'Could not confirm payment with Razorpay. Credits were not granted.');
    }
    if (remotePayment.order_id && remotePayment.order_id !== orderId) {
      return apiResponse(0, 'Payment does not match this order');
    }
    if (Number(remotePayment.amount) !== Number(payment.amount_paise)) {
      return apiResponse(0, 'Payment amount mismatch');
    }
    if (!isCapturedRazorpayPayment(remotePayment.status)) {
      if (String(remotePayment.status).toLowerCase() === 'failed') {
        await markPaymentFailed(orderId, paymentId);
      }
      return apiResponse(0, 'Payment is not captured yet. Credits were not granted.');
    }

    const fulfilled = await fulfillPaidOrder({ orderId, paymentId, signature });
    await notifyPaidSubscription({
      alreadyPaid: fulfilled.alreadyPaid,
      userId: Number(payment.user_id),
      planName: fulfilled.plan?.name,
      planCode: fulfilled.plan?.code || payment.plan_code,
      contacts: fulfilled.plan?.contacts,
      amountPaise: payment.amount_paise,
      creditsRemaining: fulfilled.wallet.creditsRemaining,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
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
    const cfg = getRazorpayConfig();
    const rawBody = (await readRawBody(event)) || '';
    const signature = String(getHeader(event, 'x-razorpay-signature') || '');
    if (cfg.webhookSecret) {
      if (!verifyWebhookSignature({ rawBody: String(rawBody), signature, webhookSecret: cfg.webhookSecret })) {
        throw createError({ statusCode: 401, statusMessage: 'Invalid webhook signature' });
      }
    } else {
      return { status: 'ignored', reason: 'RAZORPAY_WEBHOOK_SECRET is not set' };
    }
    const payload = rawBody ? JSON.parse(String(rawBody)) : await readBody(event);
    const eventName = String(payload?.event || '');
    const entity = payload?.payload?.payment?.entity || payload?.payload?.order?.entity || {};
    const orderId = String(entity?.order_id || entity?.id || '');
    const paymentId = String(entity?.id || '');

    if ((eventName === 'payment.captured' || eventName === 'order.paid') && orderId) {
      const existing = await getPaymentByOrderId(orderId);
      if (existing && existing.status !== 'paid') {
        const capturedId = eventName === 'payment.captured' ? paymentId : existing.razorpay_payment_id;
        if (capturedId && capturedId !== orderId) {
          try {
            const remotePayment = await fetchRazorpayPayment(capturedId);
            if (!isCapturedRazorpayPayment(remotePayment.status)) {
              return { status: 'ignored', reason: 'payment not captured' };
            }
            if (Number(remotePayment.amount) !== Number(existing.amount_paise)) {
              return { status: 'ignored', reason: 'amount mismatch' };
            }
          } catch {
            return { status: 'ignored', reason: 'could not confirm payment' };
          }
        }
        const fulfilled = await fulfillPaidOrder({
          orderId,
          paymentId: capturedId || paymentId,
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
          razorpayOrderId: orderId,
          razorpayPaymentId: capturedId || paymentId,
        });
      }
    }
    if (eventName === 'payment.failed' && orderId) {
      await markPaymentFailed(orderId, paymentId);
    }
    return { status: 'ok' };
  }

  return apiResponse(0, 'Endpoint not implemented');
});
