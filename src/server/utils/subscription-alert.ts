export const SUBSCRIPTION_ALERT_EMAILS = ['ankyshukla19@gmail.com', 'roomzo348@gmail.com'];

export interface SubscriptionAlertInput {
  userId: number;
  userName?: string | null;
  userEmail?: string | null;
  userPhone?: string | null;
  planName: string;
  planCode: string;
  amountPaise: number;
  contacts: number;
  creditsRemaining: number;
  razorpayOrderId: string;
  razorpayPaymentId: string;
}

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSubscriptionAlert(input: SubscriptionAlertInput): {
  to: string;
  subject: string;
  html: string;
  text: string;
} {
  const rupees = Math.round(Number(input.amountPaise || 0) / 100);
  const name = input.userName?.trim() || 'Unknown user';
  const email = input.userEmail?.trim() || '—';
  const phone = input.userPhone?.trim() || '—';
  const plan = input.planName || input.planCode || 'Plan';

  return {
    to: SUBSCRIPTION_ALERT_EMAILS.join(', '),
    subject: `New Roomzo subscription: ${plan} ₹${rupees}`,
    html: `
      <h2>New Roomzo subscription</h2>
      <p>A contact plan was paid successfully.</p>
      <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
        <tr><td><strong>Plan</strong></td><td>${escapeHtml(plan)} (${escapeHtml(input.planCode)})</td></tr>
        <tr><td><strong>Amount</strong></td><td>₹${rupees}</td></tr>
        <tr><td><strong>Contacts granted</strong></td><td>${Number(input.contacts || 0)}</td></tr>
        <tr><td><strong>Credits now</strong></td><td>${Number(input.creditsRemaining || 0)}</td></tr>
        <tr><td><strong>User</strong></td><td>${escapeHtml(name)} (id ${Number(input.userId)})</td></tr>
        <tr><td><strong>Email</strong></td><td>${escapeHtml(email)}</td></tr>
        <tr><td><strong>Phone</strong></td><td>${escapeHtml(phone)}</td></tr>
        <tr><td><strong>Razorpay order</strong></td><td>${escapeHtml(input.razorpayOrderId)}</td></tr>
        <tr><td><strong>Razorpay payment</strong></td><td>${escapeHtml(input.razorpayPaymentId)}</td></tr>
      </table>
    `,
    text: [
      `New Roomzo subscription: ${plan} ₹${rupees}`,
      `Plan: ${plan} (${input.planCode})`,
      `Amount: ₹${rupees}`,
      `Contacts granted: ${Number(input.contacts || 0)}`,
      `Credits now: ${Number(input.creditsRemaining || 0)}`,
      `User: ${name} (id ${Number(input.userId)})`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      `Razorpay order: ${input.razorpayOrderId}`,
      `Razorpay payment: ${input.razorpayPaymentId}`,
    ].join('\n'),
  };
}
