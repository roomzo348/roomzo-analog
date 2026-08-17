import { describe, expect, it } from 'vitest';
import { CONTACT_PLANS, getContactPlan, listContactPlans } from './plans';

describe('contact plans', () => {
  it('exposes Starter ₹19, Plus ₹49, and Pro ₹99 with exclusive Pro support', () => {
    expect(CONTACT_PLANS.starter.amountPaise).toBe(1900);
    expect(CONTACT_PLANS.starter.contacts).toBe(3);
    expect(CONTACT_PLANS.plus.amountPaise).toBe(4900);
    expect(CONTACT_PLANS.plus.contacts).toBe(10);
    expect(CONTACT_PLANS.pro.amountPaise).toBe(9900);
    expect(CONTACT_PLANS.pro.contacts).toBe(25);
    expect(listContactPlans()).toHaveLength(3);
    expect(CONTACT_PLANS.pro.features.some((item) => /full-time whatsapp/i.test(item))).toBe(true);
    expect(CONTACT_PLANS.starter.features.some((item) => /full-time whatsapp/i.test(item))).toBe(false);
    expect(CONTACT_PLANS.plus.features.some((item) => /full-time whatsapp/i.test(item))).toBe(false);
  });

  it('resolves plan codes case-insensitively', () => {
    expect(getContactPlan('STARTER')?.code).toBe('starter');
    expect(getContactPlan('PRO')?.code).toBe('pro');
    expect(getContactPlan('unknown')).toBeNull();
  });
});
