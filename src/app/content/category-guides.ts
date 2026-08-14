import { GuideSection } from './city-guides';

export interface CategoryGuide {
  slug: string;
  intro: string;
  sections: GuideSection[];
}

export const CATEGORY_GUIDES: Record<string, CategoryGuide> = {
  'rooms-for-rent': {
    slug: 'rooms-for-rent',
    intro:
      'Looking for a single room or shared room without unnecessary middlemen? Roomzo’s rooms-for-rent category helps you compare owner-listed rooms across cities like Prayagraj, Varanasi, Pune, and Lucknow. You can review rent, photos, and amenities, then contact the owner directly after a safety reminder — Roomzo does not charge tenants brokerage simply for browsing or calling through the platform.',
    sections: [
      {
        heading: 'What “room for rent” usually means in India',
        paragraphs: [
          'A “room” listing may be an independent bedroom in a house, a partitioned space, or a room inside a larger flat. Always confirm bathroom access (attached vs common), kitchen rights, and whether the owner lives on the same premises.',
          'Students often prefer rooms near colleges; working professionals may trade a slightly longer commute for quieter localities. Use city filters and landmarks on each listing page.',
        ],
      },
      {
        heading: 'How to shortlist rooms on Roomzo',
        paragraphs: [
          'Open a listing, check photos for natural light and cleanliness, read the description for deposit and rules, then shortlist two or three options before calling. Ask owners about water timing, electricity billing, and visitor policy.',
        ],
        bullets: [
          'Visit before paying any deposit or “token”.',
          'Clarify whether rent includes Wi‑Fi, cleaning, or power backup.',
          'Prefer written confirmation (WhatsApp/SMS) of rent and notice period.',
          'Report suspicious listings that demand advance money without a visit.',
        ],
      },
      {
        heading: 'Owner guidance for room listings',
        paragraphs: [
          'Upload clear daylight photos, state exact rent and deposit, and mention if the room is suitable for students or working professionals. Update the listing when occupied so seekers do not keep calling.',
        ],
      },
    ],
  },

  'student-housing': {
    slug: 'student-housing',
    intro:
      'Student housing on Roomzo focuses on affordable PGs, shared rooms, and campus-adjacent rentals. Whether you are moving to Prayagraj for university, Varanasi for BHU, or another city for coaching and college, the goal is the same: transparent owner contact and practical safety habits — not inflated marketing promises.',
    sections: [
      {
        heading: 'How students should evaluate housing',
        paragraphs: [
          'Beyond monthly rent, compare commute time, girls/boys PG rules, meal plans, Wi‑Fi, laundry, and study environment. Ask seniors or classmates about locality safety after dark.',
          'Parents often want to speak to the caretaker — schedule that call after you have seen the room yourself or via a trusted local contact.',
        ],
      },
      {
        heading: 'Common mistakes to avoid',
        paragraphs: [
          'Paying full deposit based only on WhatsApp photos, ignoring electricity bills that are “extra”, and skipping a written note of house rules are the most common regrets. Roomzo reminds every user not to pay before visiting.',
        ],
        bullets: [
          'Do not share OTPs or banking credentials with anyone claiming to be “Roomzo staff”. Roomzo will never ask for your bank password.',
          'Keep copies of ID proof you submit and ask for a simple rent receipt.',
          'If a listing feels too cheap for the area, verify in person before transferring money.',
        ],
      },
      {
        heading: 'Finding student options by city',
        paragraphs: [
          'Use Roomzo city pages for Prayagraj, Varanasi, Pune, and Lucknow, then filter for PG or Room. Pair that with our blog guides on deposits, visits, and scam avoidance so you rent with more confidence.',
        ],
      },
    ],
  },

  'pg-for-rent': {
    slug: 'pg-for-rent',
    intro:
      'Paying Guest (PG) housing is popular with students and early-career professionals who want food, furniture, and a managed stay. Roomzo’s PG category highlights owner and caretaker-listed PGs so you can compare inclusions and contact them directly without Roomzo brokerage on contact.',
    sections: [
      {
        heading: 'Boys PG, girls PG, and co-living notes',
        paragraphs: [
          'Many PGs are gender-specific and enforce curfew or visitor rules. Read the listing carefully and ask before visiting so you do not waste travel time. Confirm single vs double occupancy and whether the shown rent is per person.',
        ],
      },
      {
        heading: 'What a fair PG conversation includes',
        paragraphs: [
          'Ask for a sample weekly menu if food is included, water heater availability, backup power, Wi‑Fi fairness among residents, and deposit refund timelines. Request to see a vacant bed/room, not only a model room.',
          'On Roomzo, Call and WhatsApp flows include a safety notice about scam patterns such as fake booking fees. Take that seriously.',
        ],
      },
      {
        heading: 'For PG owners',
        paragraphs: [
          'State occupancy type, food inclusion, and rules upfront. Fresh photos of actual rooms convert better than downloaded images. When beds fill up, mark the listing rented or update available beds.',
        ],
      },
    ],
  },

  'flats-for-rent': {
    slug: 'flats-for-rent',
    intro:
      'Searching for a 1BHK, 2BHK, or family flat? Roomzo’s flats category helps you discover owner-listed apartments and independent floors. You still need to verify the property offline — Roomzo connects you, it does not replace site visits or legal paperwork.',
    sections: [
      {
        heading: 'Comparing flats beyond rent',
        paragraphs: [
          'Check floor level, lift availability, parking, society maintenance, water storage, and whether the flat is furnished, semi-furnished, or unfurnished. Family vs bachelor restrictions are common — clarify early.',
          'Deposits in many Indian cities equal multiple months of rent. Get the refund clause and lock-in period in writing.',
        ],
      },
      {
        heading: 'Document & visit checklist',
        paragraphs: [
          'On visit, test taps, switches, and doors. Ask who will sign the leave-and-license or rent agreement. Prefer daylight inspections. Use Roomzo’s report tool if photos do not match reality or contact behaviour seems fraudulent.',
        ],
      },
      {
        heading: 'Listing a flat as an owner',
        paragraphs: [
          'Accurate rent, society name, furnishing list, and preferred tenant profile reduce mismatched calls. Keep the listing updated when rented. Roomzo is not a brokerage agency; agreements remain between owner and tenant.',
        ],
      },
    ],
  },

  'brokerless-property': {
    slug: 'brokerless-property',
    intro:
      '“Brokerless” on Roomzo means we design the product so tenants can discover listings and contact property owners directly through the site, without Roomzo charging brokerage for that connection. We are a technology platform, not a real estate brokerage. Offline third parties may still exist in the market — you should still verify every deal carefully.',
    sections: [
      {
        heading: 'What Roomzo does and does not do',
        paragraphs: [
          'Roomzo hosts listings, provides search and city pages, enables call/WhatsApp contact after safety guidance, and lets users report problematic posts. We do not guarantee that every offline interaction will be perfect, and our Terms explain that listing accuracy ultimately depends on the information owners provide.',
          'We moderate and respond to reports, remind users about common rental scams, and encourage visits before payment. That is a process — not a claim that risk is zero.',
        ],
      },
      {
        heading: 'How to use a broker-free workflow safely',
        paragraphs: [
          'Shortlist on Roomzo, message the owner, visit with a companion if possible, negotiate rent and deposit, and document terms. Prefer owners who allow you to see the actual unit. Avoid anyone who refuses a visit but insists on an advance.',
        ],
        bullets: [
          'Never pay before seeing the property.',
          'Never share OTPs or remote-access apps with strangers.',
          'Use Roomzo report tools for fraud or wrong information.',
          'Keep rent receipts and chat records.',
        ],
      },
      {
        heading: 'Why owners list without agents',
        paragraphs: [
          'Owners use Roomzo to reach nearby tenants, reduce commission cost, and handle interest themselves. Honest descriptions and quick replies build trust faster than exaggerated claims.',
        ],
      },
    ],
  },
};

export function getCategoryGuide(slug: string): CategoryGuide | null {
  return CATEGORY_GUIDES[slug.toLowerCase()] ?? null;
}
