import { getServerRuntime } from '../utils/runtime-config';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

function basicAuthHeader(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

export function getRazorpayConfig(): {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  configured: boolean;
  mode: 'test' | 'live' | 'unset';
} {
  const { razorpayKeyId, razorpayKeySecret, razorpayWebhookSecret } = getServerRuntime();
  const mode = razorpayKeyId.startsWith('rzp_live_')
    ? 'live'
    : razorpayKeyId.startsWith('rzp_test_')
      ? 'test'
      : 'unset';
  return {
    keyId: razorpayKeyId,
    keySecret: razorpayKeySecret,
    webhookSecret: razorpayWebhookSecret,
    configured: Boolean(razorpayKeyId && razorpayKeySecret),
    mode,
  };
}

async function razorpayRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cfg = getRazorpayConfig();
  if (!cfg.configured) {
    throw new Error('Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  }
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: basicAuthHeader(cfg.keyId, cfg.keySecret),
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.description || payload?.message || `Razorpay request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

export async function createRazorpayOrder(input: {
  amountPaise: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  return razorpayRequest<RazorpayOrder>('/orders', {
    method: 'POST',
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt.slice(0, 40),
      notes: input.notes,
      payment_capture: 1,
    }),
  });
}

export async function fetchRazorpayOrder(orderId: string): Promise<RazorpayOrder> {
  return razorpayRequest<RazorpayOrder>(`/orders/${orderId}`);
}

export async function fetchRazorpayPayment(paymentId: string): Promise<{
  id: string;
  status: string;
  amount: number;
  currency: string;
  order_id?: string;
}> {
  return razorpayRequest(`/payments/${paymentId}`);
}
