import { sendMail } from './email.service';
import { getUserProfile } from './user-repository';
import { buildSubscriptionAlert, type SubscriptionAlertInput } from '../utils/subscription-alert';

export async function notifySubscriptionPurchase(input: SubscriptionAlertInput): Promise<void> {
  try {
    const mail = buildSubscriptionAlert(input);
    await sendMail(mail);
  } catch (error) {
    console.error('Subscription alert email failed', error);
  }
}

export async function notifyPaidSubscription(input: {
  alreadyPaid: boolean;
  userId: number;
  planName?: string | null;
  planCode?: string | null;
  contacts?: number;
  amountPaise?: number;
  creditsRemaining?: number;
  orderId?: string;
  paymentId?: string;
  userHint?: { name?: string | null; email?: string | null; phone?: string | null };
}): Promise<void> {
  if (input.alreadyPaid) return;
  const profile = await getUserProfile(Number(input.userId)).catch(() => null);
  await notifySubscriptionPurchase({
    userId: Number(input.userId),
    userName: profile?.displayName || profile?.name || input.userHint?.name || null,
    userEmail: profile?.email || input.userHint?.email || null,
    userPhone: profile?.phone || input.userHint?.phone || null,
    planName: input.planName || 'Plan',
    planCode: input.planCode || '',
    amountPaise: Number(input.amountPaise || 0),
    contacts: Number(input.contacts || 0),
    creditsRemaining: Number(input.creditsRemaining || 0),
    orderId: input.orderId || '',
    paymentId: input.paymentId || '',
  });
}
