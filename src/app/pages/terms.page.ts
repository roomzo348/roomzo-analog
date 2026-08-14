import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteMeta } from '@analogjs/router';

export const routeMeta: RouteMeta = {
  title: 'Terms & Conditions | Roomzo',
  meta: [
    {
      name: 'description',
      content:
        'Terms of use for Roomzo — the rental listing platform connecting tenants and property owners in India.',
    },
  ],
};

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="legal-container">
      <h1>Terms &amp; Conditions</h1>
      <p><strong>Last Updated:</strong> July 2026</p>
      <p>
        These Terms &amp; Conditions (“Terms”) govern your use of <strong>Roomzo</strong> at
        <a href="https://www.roomzo.in">www.roomzo.in</a> and related services. By accessing or using Roomzo, you
        agree to these Terms. If you do not agree, do not use the service.
      </p>

      <h2>1. About Roomzo</h2>
      <p>
        Roomzo is an online platform that publishes rental listings (rooms, PGs, flats, and related housing) submitted
        by users and helps seekers contact listing owners. <strong>Roomzo is not a real estate broker, real estate
        agent, or property dealer.</strong> We do not buy, sell, or lease property on your behalf, and we do not
        guarantee that any listing is available, accurate, or suitable for your needs.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be legally able to enter a contract under applicable Indian law to create an account or list a
        property. You are responsible for keeping your login credentials confidential and for activity under your account.
      </p>

      <h2>3. Accounts &amp; acceptable use</h2>
      <ul>
        <li>Provide accurate registration information.</li>
        <li>Do not post fraudulent, misleading, stolen, discriminatory, or illegal listings or content.</li>
        <li>Do not scrape, abuse, or disrupt the platform, or attempt to extract other users’ data unlawfully.</li>
        <li>Do not impersonate Roomzo staff or request OTPs, passwords, or remote access from other users.</li>
      </ul>
      <p>
        We may remove content, suspend accounts, or restrict features if we reasonably believe these Terms or
        applicable laws were violated.
      </p>

      <h2>4. Listings &amp; user content</h2>
      <p>
        Owners are solely responsible for the accuracy of rent, photos, amenities, availability, and contact details.
        By uploading content, you grant Roomzo a non-exclusive licence to host, display, and distribute that content
        to operate and promote the platform. You represent that you have the rights to publish the content and that
        it does not infringe others’ rights.
      </p>

      <h2>5. No brokerage fee for platform contact — offline deals are yours</h2>
      <p>
        Roomzo’s product is designed so tenants can browse listings and contact owners through the site without Roomzo
        charging brokerage for that connection. Any rent, deposit, agreement, keys, or payment arrangement is strictly
        between the owner and the seeker. If you involve a third-party broker offline, that relationship is outside Roomzo.
      </p>

      <h2>6. Safety — visit before you pay</h2>
      <p>
        Rental scams exist. You agree to exercise independent judgment: visit properties (or verify through trusted
        means) before paying deposits, and be cautious of advance “booking”, “token”, or “visit” fees demanded without
        a genuine property inspection. Roomzo may show safety reminders and offer reporting tools; these do not make
        Roomzo liable for user conduct.
      </p>

      <h2>7. Fees</h2>
      <p>
        Browsing and contacting owners through Roomzo is generally free for seekers unless we clearly state otherwise
        for a specific paid feature. Optional paid promotions for owners, if introduced, will be described at the point
        of purchase. Third-party payment, telecom, or device charges are your responsibility.
      </p>

      <h2>8. Intellectual property</h2>
      <p>
        Roomzo branding, site design, logos, and original platform content are owned by Roomzo or its licensors.
        You may not copy or reuse them without permission, except for fair personal use of publicly available pages.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE”. TO THE MAXIMUM EXTENT PERMITTED BY LAW, ROOMZO DISCLAIMS
        WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT
        UNINTERRUPTED ACCESS OR THAT LISTINGS ARE ERROR-FREE.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Roomzo and its operators shall not be liable for indirect, incidental,
        special, consequential, or punitive damages, or for loss of profits, data, or goodwill arising from your use of
        the service or disputes between users. Our aggregate liability for claims relating to the service is limited to
        the greater of (a) amounts you paid Roomzo (if any) in the three months before the claim or (b) INR 1,000.
      </p>

      <h2>11. Indemnity</h2>
      <p>
        You agree to indemnify and hold harmless Roomzo from claims arising out of your listings, your misuse of the
        platform, or your violation of these Terms or applicable law.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These Terms are governed by the laws of India. Courts in India shall have exclusive jurisdiction over disputes,
        subject to any mandatory consumer protections that apply.
      </p>

      <h2>13. Changes</h2>
      <p>
        We may update these Terms periodically. Continued use after changes are posted constitutes acceptance.
        Material changes will be reflected in the “Last Updated” date.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions about these Terms: <a href="mailto:support&#64;roomzo.in">support&#64;roomzo.in</a><br />
        Website: <a href="https://www.roomzo.in">https://www.roomzo.in</a>
      </p>
    </div>
  `,
  styles: [`
    .legal-container {
      max-width: 800px;
      margin: 60px auto;
      padding: 20px;
      color: var(--rz-text-main);
      font-family: var(--font-sans);
      line-height: 1.65;
      min-height: 60vh;
    }
    h1 { font-size: 2.35rem; margin-bottom: 8px; color: var(--rz-text-main); }
    h2 { font-size: 1.35rem; margin-top: 32px; margin-bottom: 12px; color: var(--rz-primary); }
    p, ul { font-size: 1.02rem; color: var(--rz-text-muted); margin-bottom: 14px; }
    ul { padding-left: 24px; }
    li { margin-bottom: 8px; }
    a { color: var(--rz-primary); text-decoration: underline; }
    @media (max-width: 600px) {
      .legal-container { margin: 24px auto; padding: 16px; }
      h1 { font-size: 1.85rem; }
      h2 { font-size: 1.2rem; margin-top: 24px; }
      p, ul { font-size: 1rem; }
    }
  `]
})
export default class TermsComponent {}
