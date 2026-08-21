import { describe, expect, it } from 'vitest';
import { SUBSCRIPTION_ALERT_EMAILS, buildSubscriptionAlert } from '../utils/subscription-alert';

describe('subscription purchase alerts', () => {
  it('mails both Roomzo inboxes and includes plan plus payer details', () => {
    const mail = buildSubscriptionAlert({
      userId: 42,
      userName: 'Ankit <test>',
      userEmail: 'buyer@example.com',
      userPhone: '9876543210',
      planName: 'Pro',
      planCode: 'pro',
      amountPaise: 9900,
      contacts: 25,
      creditsRemaining: 25,
      orderId: 'order_abc',
      paymentId: 'pay_xyz',
    });

    expect(mail.to).toBe('ankyshukla19@gmail.com, roomzo348@gmail.com');
    expect(mail.to.split(', ')).toEqual(SUBSCRIPTION_ALERT_EMAILS);
    expect(mail.subject).toBe('New Roomzo subscription: Pro ₹99');
    expect(mail.html).toContain('Ankit &lt;test&gt;');
    expect(mail.html).toContain('buyer@example.com');
    expect(mail.html).toContain('₹99');
    expect(mail.text).toContain('Cashfree payment: pay_xyz');
  });
});
