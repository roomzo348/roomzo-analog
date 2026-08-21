import { getServerRuntime } from '../utils/runtime-config';

const API_VERSION = '2023-08-01';

export type CashfreeMode = 'sandbox' | 'production' | 'unset';

export interface CashfreeOrder {
  order_id: string;
  order_amount: number;
  order_currency: string;
  order_status?: string;
  payment_session_id?: string;
  cf_order_id?: string | number;
}

export interface CashfreePayment {
  cf_payment_id?: string | number;
  payment_status?: string;
  payment_amount?: number;
  order_id?: string;
  payment_currency?: string;
}

export function getCashfreeConfig(): {
  appId: string;
  secretKey: string;
  configured: boolean;
  mode: CashfreeMode;
  apiBase: string;
} {
  const { cashfreeAppId, cashfreeSecretKey, cashfreeEnv } = getServerRuntime();
  const env = String(cashfreeEnv || '').toLowerCase();
  const mode: CashfreeMode = !cashfreeAppId || !cashfreeSecretKey
    ? 'unset'
    : env === 'production' || env === 'live'
      ? 'production'
      : 'sandbox';
  return {
    appId: cashfreeAppId,
    secretKey: cashfreeSecretKey,
    configured: Boolean(cashfreeAppId && cashfreeSecretKey),
    mode,
    apiBase:
      mode === 'production'
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg',
  };
}

async function cashfreeRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cfg = getCashfreeConfig();
  if (!cfg.configured) {
    throw new Error('Cashfree is not configured. Add CASHFREE_APP_ID and CASHFREE_SECRET_KEY.');
  }
  const response = await fetch(`${cfg.apiBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-api-version': API_VERSION,
      'x-client-id': cfg.appId,
      'x-client-secret': cfg.secretKey,
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error?.message ||
      (Array.isArray(payload?.message) ? payload.message.join(', ') : null) ||
      `Cashfree request failed (${response.status})`;
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }
  return payload as T;
}

export async function createCashfreeOrder(input: {
  orderId: string;
  amountRupees: number;
  currency: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  orderNote?: string;
  returnUrl: string;
  notifyUrl?: string;
}): Promise<CashfreeOrder> {
  const phone = String(input.customerPhone || '').replace(/\D/g, '').slice(-10);
  const body: Record<string, unknown> = {
    order_id: input.orderId,
    order_amount: Number(input.amountRupees),
    order_currency: input.currency || 'INR',
    customer_details: {
      customer_id: String(input.customerId).slice(0, 50),
      customer_name: input.customerName || 'Roomzo User',
      customer_email: input.customerEmail || undefined,
      // Cashfree requires a 10-digit Indian mobile for most flows.
      customer_phone: phone.length === 10 ? phone : '9999999999',
    },
    order_meta: {
      return_url: input.returnUrl,
      ...(input.notifyUrl ? { notify_url: input.notifyUrl } : {}),
    },
  };
  if (input.orderNote) {
    body.order_note = input.orderNote.slice(0, 200);
  }
  return cashfreeRequest<CashfreeOrder>('/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchCashfreeOrder(orderId: string): Promise<CashfreeOrder> {
  return cashfreeRequest<CashfreeOrder>(`/orders/${encodeURIComponent(orderId)}`);
}

export async function fetchCashfreeOrderPayments(orderId: string): Promise<{
  payments?: CashfreePayment[];
}> {
  return cashfreeRequest(`/orders/${encodeURIComponent(orderId)}/payments`);
}

/** Best-effort payment id for an order (newest successful payment preferred). */
export async function resolveCashfreePaymentId(orderId: string): Promise<string | null> {
  try {
    const data = await fetchCashfreeOrderPayments(orderId);
    const payments = Array.isArray(data?.payments) ? data.payments : [];
    const success = payments.find((p) => isPaidCashfreePayment(p.payment_status));
    const pick = success || payments[0];
    if (!pick?.cf_payment_id) return null;
    return String(pick.cf_payment_id);
  } catch {
    return null;
  }
}

export function isPaidCashfreeOrder(status: string | null | undefined): boolean {
  return String(status || '').toUpperCase() === 'PAID';
}

export function isPaidCashfreePayment(status: string | null | undefined): boolean {
  const value = String(status || '').toUpperCase();
  return value === 'SUCCESS' || value === 'PAID';
}

export function isFailedCashfreePayment(status: string | null | undefined): boolean {
  const value = String(status || '').toUpperCase();
  return value === 'FAILED' || value === 'USER_DROPPED' || value === 'CANCELLED';
}
