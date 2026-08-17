export type PlanCode = 'plus' | 'pro';

export interface ContactPlan {
  code: PlanCode;
  name: string;
  tagline: string;
  amountPaise: number;
  currency: 'INR';
  contacts: number;
  durationDays: number;
  popular: boolean;
  features: string[];
}

export const FREE_OWNER_CONTACTS = 1;

export const CONTACT_PLANS: Record<PlanCode, ContactPlan> = {
  plus: {
    code: 'plus',
    name: 'Plus',
    tagline: 'For focused house hunting',
    amountPaise: 4900,
    currency: 'INR',
    contacts: 10,
    durationDays: 30,
    popular: false,
    features: [
      '10 Property Contacts',
      'Direct Owner Contact',
      'Advanced Filters',
      'New Listing Alerts',
      'No Brokerage',
    ],
  },
  pro: {
    code: 'pro',
    name: 'Pro',
    tagline: 'Most popular for serious seekers',
    amountPaise: 9900,
    currency: 'INR',
    contacts: 25,
    durationDays: 30,
    popular: true,
    features: [
      '25 Property Contacts',
      'Direct Owner Contact',
      'Advanced Filters',
      'New Listing Alerts',
      'No Brokerage',
      'WhatsApp Support',
      'Shortlist & Compare Properties',
    ],
  },
};

export function listContactPlans(): ContactPlan[] {
  return [CONTACT_PLANS.plus, CONTACT_PLANS.pro];
}

export function getContactPlan(code: string | null | undefined): ContactPlan | null {
  if (!code) return null;
  const key = code.toLowerCase() as PlanCode;
  return CONTACT_PLANS[key] ?? null;
}

export function formatPlanPrice(plan: ContactPlan): string {
  return `₹${Math.round(plan.amountPaise / 100)}/month`;
}
