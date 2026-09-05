export type PlanCode = 'starter' | 'plus' | 'pro';

export interface ContactPlan {
  code: PlanCode;
  name: string;
  tagline: string;
  amountPaise: number;
  originalAmountRupees?: number;
  offerLabel?: string;
  currency: 'INR';
  contacts: number;
  durationDays: number;
  popular: boolean;
  features: string[];
}

export const FREE_OWNER_CONTACTS = 0;
export const PLAN_DURATION_DAYS = 30;

export const CONTACT_PLANS: Record<PlanCode, ContactPlan> = {
  starter: {
    code: 'starter',
    name: 'Starter',
    tagline: 'Start with 4 owner contacts',
    amountPaise: 1900,
    originalAmountRupees: 49,
    offerLabel: 'Early bird offer · ending soon',
    currency: 'INR',
    contacts: 4,
    durationDays: PLAN_DURATION_DAYS,
    popular: false,
    features: [
      '4 Property Contacts',
      'Direct Owner Contact',
      'No brokerage cut on rent',
    ],
  },
  plus: {
    code: 'plus',
    name: 'Plus',
    tagline: 'For focused house hunting',
    amountPaise: 4900,
    currency: 'INR',
    originalAmountRupees: 99,
    offerLabel: 'Early bird offer · ending soon',
    contacts: 11,
    durationDays: PLAN_DURATION_DAYS,
    popular: false,
    features: [
      '11 Property Contacts',
      'Direct Owner Contact',
      'New Listing Alerts',
      'No brokerage cut on rent',
    ],
  },
  pro: {
    code: 'pro',
    name: 'Pro',
    tagline: 'Most popular for serious seekers',
    amountPaise: 9900,
    originalAmountRupees: 199,
    offerLabel: 'Early bird offer · ending soon',
    currency: 'INR',
    contacts: 25,
    durationDays: PLAN_DURATION_DAYS,
    popular: true,
    features: [
      '25 Property Contacts',
      'Direct Owner Contact',
      'New Listing Alerts',
      'No brokerage cut on rent',
      'WhatsApp chat support',
      'Shortlist & Compare Properties',
    ],
  },
};

type EnvPlan = {
  code?: string;
  price?: number;
  contacts?: number;
  originalPrice?: number;
};

/**
 * Optional JSON from CONTACT_PLANS_JSON. Invalid or incomplete entries safely
 * fall back to the defaults above, so bad deployment config cannot create a
 * zero-price order.
 */
export function listContactPlans(rawConfig?: string | null): ContactPlan[] {
  let configured: EnvPlan[] = [];
  if (rawConfig) {
    try {
      const parsed = JSON.parse(rawConfig);
      if (Array.isArray(parsed)) configured = parsed;
    } catch {
      configured = [];
    }
  }

  return (['starter', 'plus', 'pro'] as PlanCode[]).map((code) => {
    const base = CONTACT_PLANS[code];
    const envPlan = configured.find((item) => String(item?.code).toLowerCase() === code);
    const price = Number(envPlan?.price);
    const contacts = Number(envPlan?.contacts);
    const originalPrice = Number(envPlan?.originalPrice);
    const resolvedContacts = Number.isInteger(contacts) && contacts > 0 ? contacts : base.contacts;

    return {
      ...base,
      amountPaise: Number.isFinite(price) && price > 0 ? Math.round(price * 100) : base.amountPaise,
      contacts: resolvedContacts,
      originalAmountRupees:
        Number.isFinite(originalPrice) && originalPrice > 0
          ? originalPrice
          : base.originalAmountRupees,
      tagline:
        code === 'starter'
          ? `Start with ${resolvedContacts} owner contacts`
          : base.tagline,
      features: [
        `${resolvedContacts} Property Contacts`,
        ...base.features.slice(1),
      ],
    };
  });
}

export function getContactPlan(
  code: string | null | undefined,
  rawConfig?: string | null
): ContactPlan | null {
  if (!code) return null;
  const key = code.toLowerCase() as PlanCode;
  return listContactPlans(rawConfig).find((plan) => plan.code === key) ?? null;
}

export function formatPlanPrice(plan: ContactPlan): string {
  return `₹${Math.round(plan.amountPaise / 100)}/month`;
}
