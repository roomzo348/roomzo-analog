import { Component, OnInit, OnDestroy, Inject, Renderer2 } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { RouteMeta } from '@analogjs/router';

// 1. ANALOG ROUTE META: Highly targeted for the UP region
export const routeMeta: RouteMeta = {
  title: 'Frequently Asked Questions | Roomzo Rentals',
  meta: [
    { 
      name: 'description', 
      content: 'FAQ about Roomzo — how owner-listed rooms, PGs, and flats work, fees, safety tips, and support for cities across India.' 
    },
    { 
      name: 'keywords', 
      content: 'roomzo faq, how to find pg, flat rent tips, owner contact rentals, rental safety' 
    }
  ]
};

interface FaqItem {
  question: string;
  answer: string;
  category: 'General' | 'Tenants' | 'Owners';
  isOpen?: boolean; 
}

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './faq.html',
  styleUrls: ['./faq.css']
})
export default class FaqComponent implements OnInit, OnDestroy {
  constructor(
    private router: Router,
    @Inject(DOCUMENT) private document: Document,
    private renderer: Renderer2
  ) {}

  activeCategory: string = 'General';

  // 2. EXPANDED FAQS: Kept your originals and added high-volume SEO questions
  allFaqs: FaqItem[] = [
    {
      question: 'What is Roomzo?',
      answer: 'Roomzo is an online rental listing platform at roomzo.in. Property owners publish rooms, PGs, and flats; seekers browse, compare, and contact owners directly after a short safety reminder. Roomzo is a technology platform, not a real estate brokerage.',
      category: 'General'
    },
    {
      question: 'Is Roomzo free to use?',
      answer: 'Browsing listings and contacting owners through Roomzo is free for tenants. Owners can list properties for discovery on the platform. Any optional paid promotion features, if offered later, will be clearly labelled before purchase.',
      category: 'General'
    },
    {
      question: 'How do I contact customer support?',
      answer: 'Email us at support@roomzo.in or use the Contact form on the Roomzo homepage. We aim to respond to support and listing-report queries as quickly as possible during business hours.',
      category: 'General'
    },
    {
      question: 'Does Roomzo charge brokerage?',
      answer: 'Roomzo does not charge tenants brokerage simply for browsing or contacting an owner through the website. Offline rent, deposits, and any third-party help you arrange yourself are between you and those parties. Always clarify costs before paying.',
      category: 'Tenants'
    },
    {
      question: 'Are listings guaranteed accurate?',
      answer: 'No. Owners are responsible for the information they publish. Roomzo provides tools to report incorrect or suspicious listings and reminds users to visit properties before paying deposits. Treat every listing as a starting point for offline verification.',
      category: 'Tenants'
    },
    {
      question: 'How can I stay safe while renting?',
      answer: 'Visit the property before paying. Never share OTPs or bank passwords. Be cautious if someone demands “token”, “gate pass”, or “booking” fees without letting you see the room. Prefer written confirmation of rent, deposit, and notice period. Use Roomzo’s report option if something feels wrong.',
      category: 'Tenants'
    },
    {
      question: 'How can I find a room for rent in Prayagraj?',
      answer: 'Open the Prayagraj city page on Roomzo, filter by Room / PG / Flat, and compare owner-listed options in areas such as Katra, Civil Lines, Mumfordganj, and nearby localities. Contact owners after reading details, then visit before you pay.',
      category: 'Tenants'
    },
    {
      question: 'What are good areas for students to rent a PG in Varanasi?',
      answer: 'Students often look near BHU, Lanka, Durgakund, and Assi. Quality varies street by street — shortlist on Roomzo, ask about food, curfew, and occupancy, and visit in person. Read our Varanasi city guide on the city page for more context.',
      category: 'Tenants'
    },
    {
      question: 'How does Roomzo differ from large property portals?',
      answer: 'Many large portals mix brokers and owners. Roomzo focuses on owner-listed discovery and direct contact through our product, plus city/category educational guides. We do not claim to replace your due diligence — we help you start conversations faster.',
      category: 'General'
    },
    {
      question: 'Can I find PG for rent in Pune without paying portal brokerage?',
      answer: 'Yes — Roomzo does not charge tenants brokerage for contacting owners via the site. Browse Pune listings (Hinjewadi, Viman Nagar, Kothrud, Wakad, Baner and more when available), visit properties, and confirm all money transfers only after you are comfortable.',
      category: 'Tenants'
    },
    {
      question: 'How do I list my property without an agent?',
      answer: 'Sign up on Roomzo, open List Property / Add Listing, upload honest photos, set rent and amenities, and publish. When rented, update the status so seekers do not keep calling. You handle agreements and deposits directly with the tenant.',
      category: 'Owners'
    },
    {
      question: 'What should owners never do?',
      answer: 'Do not upload photos of properties you do not control, invent amenities, or ask tenants for money before showing the actual unit. Misleading listings may be removed and accounts restricted.',
      category: 'Owners'
    },
    {
      question: 'Does Roomzo verify every listing personally?',
      answer: 'Roomzo uses account checks, user reports, and product moderation. We do not claim that a Roomzo employee has physically inspected every property. Always visit yourself before paying.',
      category: 'General'
    }
  ];

  ngOnInit() {
    this.injectFaqSchema();
  }

  ngOnDestroy() {
    this.removeFaqSchema();
  }

  // 3. DYNAMIC JSON-LD GENERATOR: Automatically creates schema for Google
  private injectFaqSchema() {
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": this.allFaqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    };

    const script = this.renderer.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'roomzo-faq-schema';
    script.text = JSON.stringify(schema);
    this.renderer.appendChild(this.document.head, script);
  }

  private removeFaqSchema() {
    const existingScript = this.document.getElementById('roomzo-faq-schema');
    if (existingScript) {
      this.renderer.removeChild(this.document.head, existingScript);
    }
  }

  get displayFaqs() {
    return this.allFaqs.filter(f => f.category === this.activeCategory);
  }

  setCategory(cat: string) {
    this.activeCategory = cat;
  }

  toggleItem(item: FaqItem) {
    item.isOpen = !item.isOpen;
  }
  
  goToContact() {
    this.router.navigate(['/'], { fragment: 'contactUs' });
  }
}