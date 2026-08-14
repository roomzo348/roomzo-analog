/** Unique long-form city guides for AdSense / SEO quality (not template filler). */
export interface GuideSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface CityGuide {
  slug: string;
  tagline: string;
  intro: string;
  sections: GuideSection[];
}

export const CITY_GUIDES: Record<string, CityGuide> = {
  prayagraj: {
    slug: 'prayagraj',
    tagline: 'Student rooms, PGs & flats near colleges and key localities',
    intro:
      'Prayagraj (Allahabad) is one of Uttar Pradesh’s busiest rental markets for students and working professionals. Demand stays high around Allahabad University, Katra, Civil Lines, Mumfordganj, Teliarganj, and Naini. Roomzo helps you browse owner-listed rooms, paying guest (PG) accommodations, and flats, then contact the owner directly after a simple safety reminder — without paying platform brokerage to Roomzo for browsing or owner contact.',
    sections: [
      {
        heading: 'Popular areas to rent in Prayagraj',
        paragraphs: [
          'Choosing the right locality is as important as the rent. Each neighbourhood has a different mix of budget rooms, shared PGs, and family flats.',
        ],
        bullets: [
          'Katra & surrounding lanes — strong demand for single rooms and budget PGs near markets and bus routes.',
          'Civil Lines — preferred for working professionals and higher-budget 1BHK / 2BHK flats with better roads and amenities.',
          'Mumfordganj & Teliarganj — popular with students who want shorter travel to colleges and coaching centres.',
          'Naini & outskirts — often slightly lower rents for similar room sizes; check commute time before locking a visit.',
        ],
      },
      {
        heading: 'Typical rents and what affects price',
        paragraphs: [
          'Rents in Prayagraj vary by locality, attachment bathrooms, furniture, and whether meals or Wi‑Fi are included. Budget single rooms and shared PGs are usually more affordable than independent 1BHK flats in Civil Lines.',
          'Always confirm what is included in the quoted monthly rent — electricity, water, cooking gas, Wi‑Fi, washing machine access, and security deposit. Ask the owner for a clear breakup before transferring any money.',
        ],
      },
      {
        heading: 'How Roomzo listings work in Prayagraj',
        paragraphs: [
          'Owners publish photos, rent, amenities, and location details on Roomzo. You can filter by property type (room, PG, flat), sort by newest or price, and open a listing to read the full description and safety tips.',
          'When you choose Call or WhatsApp, Roomzo shows a short safety message: never pay before visiting, and treat visit charges / advance “booking fees” demanded without meeting as a red flag. You may also report a listing if it looks fraudulent or incorrect.',
        ],
      },
      {
        heading: 'Renter checklist for Prayagraj',
        paragraphs: [
          'Use this checklist on every visit — whether you found the listing on Roomzo or elsewhere.',
        ],
        bullets: [
          'Visit the property in person (or with a trusted companion) before paying any deposit.',
          'Match the rooms and photos to what you see on site; check water supply, power backup, and mobile network.',
          'Ask who holds the property documents / ownership proof and clarify lock-in, notice period, and deposit refund rules in writing (message or simple agreement).',
          'Prefer daylight visits; meet the owner or authorised caretaker, not unknown intermediaries demanding cash.',
          'If something feels wrong, use Roomzo’s report option and walk away — another listing is always better than a rushed advance.',
        ],
      },
      {
        heading: 'For owners listing in Prayagraj',
        paragraphs: [
          'Honest photos, accurate rent, clear amenities, and a reachable phone number get better responses. Update status when the property is rented so seekers do not waste calls. Roomzo is a connection platform: agreements, deposits, and keys remain between you and the tenant.',
        ],
      },
    ],
  },

  varanasi: {
    slug: 'varanasi',
    tagline: 'PG & rooms near BHU, Lanka, Assi and Sigra',
    intro:
      'Varanasi (Banaras / Kashi) attracts thousands of students every year, especially around Banaras Hindu University (BHU). Students and young professionals commonly search for PGs and rooms in Lanka, Durgakund, Assi, Sigra, and nearby localities. Roomzo lists owner-published rentals so you can compare options and speak with owners directly, without Roomzo charging you brokerage for viewing or contacting a listing.',
    sections: [
      {
        heading: 'Best student localities in Varanasi',
        paragraphs: [
          'Proximity to BHU and coachings drives most student rentals. Commute, girls/boys PG rules, and meal plans matter as much as the monthly rent.',
        ],
        bullets: [
          'Lanka & BHU gate areas — densest supply of student PGs and shared rooms; visit in person because quality varies street by street.',
          'Assi & south campus side — mix of PGs and flat shares; popular with long-stay students.',
          'Sigra & central belts — often easier for professionals who need bus/auto connectivity across the city.',
          'Sarnath / outer rings — sometimes lower rent; confirm travel time to campus before committing.',
        ],
      },
      {
        heading: 'What students should compare in a Varanasi PG',
        paragraphs: [
          'Beyond rent, ask about food (veg-only vs flexible), curfew, visitor policy, laundry, water timing, power backup, and Wi‑Fi speed. Shared bathrooms and double occupancy are common — confirm occupancy before you arrive.',
          'Prefer listings with recent photos and an owner who is willing to meet at the property. On Roomzo, read the full description and use Call / WhatsApp only after you have shortlisted 2–3 options.',
        ],
      },
      {
        heading: 'Safety tips for new arrivals',
        paragraphs: [
          'New students sometimes face pressure to pay “token” money after a quick WhatsApp chat. On Roomzo we remind every user: do not pay before visiting and meeting the responsible person. Beware of anyone asking for gate-pass fees or advance booking amounts without showing the room.',
          'Carry a copy of your college ID when visiting. Keep a friend informed of your visit location. Document the agreed rent, deposit, and notice period in chat before you transfer money.',
        ],
      },
      {
        heading: 'How to use Roomzo for Varanasi rentals',
        paragraphs: [
          'Open the Varanasi city page, filter by PG / Room / Flat, and sort by newest or budget. Save favourites after login. When contacting an owner, politely ask for the exact landmark, nearest gate for BHU-side properties, and whether the rent includes electricity.',
          'Owners can list free for discovery on Roomzo and update availability when occupied. Clear house rules in the description reduce conflict later.',
        ],
      },
    ],
  },

  pune: {
    slug: 'pune',
    tagline: 'Rooms, PGs & flats in Hinjewadi, Viman Nagar, Kothrud & more',
    intro:
      'Pune’s rental market serves IT professionals, students, and families across Hinjewadi, Wakad, Baner, Viman Nagar, Kothrud, and nearby hubs. Competition for good 1BHKs and shared flats is high — so transparent owner contact and realistic photos matter. Roomzo is built for direct owner–tenant discovery with brokerage-free browsing and contact on our platform.',
    sections: [
      {
        heading: 'Localities renters ask about most',
        paragraphs: [
          'Pune is large; “good area” depends on office location, metro/bus access, and whether you want a shared flat or independent unit.',
        ],
        bullets: [
          'Hinjewadi / Wakad — IT corridor demand; many PGs and shared flats; check travel time within Hinjewadi phases.',
          'Baner / Baltiwadi belt — popular with professionals seeking 1BHK / 2BHK; rents reflect demand.',
          'Viman Nagar / Kalyani Nagar side — airport-side connectivity; mix of studios, PGs, and flats.',
          'Kothrud / Karve Nagar — established residential pockets; often preferred by families and long-stay tenants.',
        ],
      },
      {
        heading: 'Budget planning for Pune rentals',
        paragraphs: [
          'Expect deposit requests of multiple months’ rent in many buildings (confirm locally). Ask whether society maintenance, parking, and brokerage (if any third party is involved outside Roomzo) are separate. Roomzo itself does not take brokerage for connecting you with owners through the site.',
          'For flat shares, clarify how utilities are split and whether the leave-and-license agreement will be in your name or a flatmate’s.',
        ],
      },
      {
        heading: 'Using Roomzo effectively in Pune',
        paragraphs: [
          'Filter by property type and budget on city or explore pages. Message owners with your move-in date and company/college — responsiveness is higher when you are clear. Use the in-app safety reminder: visit before paying.',
          'If a listing looks outdated or suspicious, report it. Owners should mark properties rented to keep the Pune feed useful for everyone.',
        ],
      },
      {
        heading: 'Owner tips for Pune listings',
        paragraphs: [
          'Include society name or landmark, floor, furnishing level, and parking. Recent daylight photos outperform stock images. State preferred tenant profile (family / bachelor / working professional) honestly to save time for both sides.',
        ],
      },
    ],
  },

  lucknow: {
    slug: 'lucknow',
    tagline: 'Flats, rooms & PGs across Gomti Nagar, Hazratganj & Alambagh',
    intro:
      'Lucknow’s rentals span heritage localities and newer residential sectors. Working professionals often look toward Gomti Nagar and nearby sectors, while students and budget seekers compare rooms and PGs across Alambagh, Aminabad-adjacent belts, and other connected areas. Roomzo surfaces owner-listed inventory so you can evaluate options and talk to owners without paying Roomzo a brokerage fee for discovery or contact.',
    sections: [
      {
        heading: 'Where to look first in Lucknow',
        paragraphs: [
          'Match locality to your workplace, college, or family needs rather than chasing the cheapest pin on the map.',
        ],
        bullets: [
          'Gomti Nagar & extensions — flats and independent floors for professionals and families; confirm tower amenities and parking.',
          'Hazratganj / central belts — convenient for city travel; inventory mixes rooms and smaller flats.',
          'Alambagh & south/west access — practical for travellers and budget-conscious tenants checking railway/road connectivity.',
          'Newer sectors — more project inventory; verify builder finishing, water, and maintenance before paying token money.',
        ],
      },
      {
        heading: 'Questions every Lucknow renter should ask',
        paragraphs: [
          'Ask about power backup, water supply hours, society rules for bachelors, and whether cooking is allowed. For PGs, confirm meal timings and laundry. For flats, clarify brokerage if any offline agent suddenly joins the deal — Roomzo’s product goal is direct owner contact.',
          'Never transfer deposits solely on WhatsApp promise of “keys tomorrow.” Visit, verify the person you meet, and keep a written trail of agreed terms.',
        ],
      },
      {
        heading: 'Roomzo’s role in Lucknow rentals',
        paragraphs: [
          'We publish listings that owners create, help you browse by filters, and facilitate call/WhatsApp after safety guidance. We do not replace physical verification, legal agreements, or police verification processes that your college or employer may require.',
          'Report incorrect rents, stolen photos, or scam behaviour. Strong reporting keeps Lucknow’s inventory healthier for the next renter.',
        ],
      },
    ],
  },
};

export function getCityGuide(slug: string): CityGuide | null {
  return CITY_GUIDES[slug.toLowerCase()] ?? null;
}
