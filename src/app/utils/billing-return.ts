export const BILLING_RETURN_KEY = 'roomzo_billing_return';
export type PaymentReturnStatus = 'success' | 'failed' | 'cancelled';

export function sanitizeBillingReturnUrl(
  raw: string | null | undefined,
  fallback = ''
): string {
  if (!raw) return fallback;
  let value = String(raw).trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    // keep the raw value when it is not encoded
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('/owner-auth')) return fallback;
  if (value.length > 500 || /[\s<>]/.test(value)) return fallback;
  return value;
}

export function withPaymentStatus(url: string, status: PaymentReturnStatus): string {
  const safe = sanitizeBillingReturnUrl(url, '/');
  const parsed = new URL(safe, 'https://www.roomzo.in');
  parsed.searchParams.set('payment', status);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function paymentReturnNotice(
  status: string | null | undefined
): { level: 'success' | 'error' | 'info'; message: string } | null {
  if (status === 'success') {
    return { level: 'success', message: 'Payment successful. Your contact credits are ready.' };
  }
  if (status === 'failed') {
    return { level: 'error', message: 'Payment failed. You can try again whenever you are ready.' };
  }
  if (status === 'cancelled') {
    return { level: 'info', message: 'Payment was cancelled. No credits were added.' };
  }
  return null;
}

export function planDisplayName(code: string | null | undefined): string {
  const key = String(code || '').toLowerCase();
  if (key === 'starter') return 'Starter';
  if (key === 'plus') return 'Plus';
  if (key === 'pro') return 'Pro';
  return 'Plan';
}
