import { describe, expect, it } from 'vitest';
import { CONTACT_PLANS, getContactPlan, listContactPlans } from './plans';

describe('contact plans', () => {
  it('exposes Plus at ₹49 for 10 contacts and Pro at ₹99 for 25 contacts', () => {
    expect(CONTACT_PLANS.plus.amountPaise).toBe(4900);
    expect(CONTACT_PLANS.plus.contacts).toBe(10);
    expect(CONTACT_PLANS.pro.amountPaise).toBe(9900);
    expect(CONTACT_PLANS.pro.contacts).toBe(25);
    expect(listContactPlans()).toHaveLength(2);
  });

  it('resolves plan codes case-insensitively', () => {
    expect(getContactPlan('PRO')?.code).toBe('pro');
    expect(getContactPlan('unknown')).toBeNull();
  });
});
