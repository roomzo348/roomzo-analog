import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteMeta } from '@analogjs/router';

export const routeMeta: RouteMeta = {
  title: 'Privacy Policy | Roomzo',
  meta: [
    {
      name: 'description',
      content:
        'Read how Roomzo collects, uses, and protects personal data, including cookies and Google AdSense advertising on roomzo.in.',
    },
  ],
};

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="legal-container">
      <h1>Privacy Policy</h1>
      <p><strong>Last Updated:</strong> July 2026</p>
      <p>
        This Privacy Policy explains how <strong>Roomzo</strong> (“we”, “us”, “our”), operating the website
        <a href="https://www.roomzo.in">www.roomzo.in</a>, collects, uses, stores, and shares information when you
        use our rental discovery platform. By using Roomzo, you agree to this policy.
      </p>

      <h2>1. Who we are</h2>
      <p>
        Roomzo is an online platform that helps people discover rooms, PGs, and flats listed by property owners and
        contact those owners. We are not a real estate brokerage. For privacy questions, email
        <a href="mailto:support&#64;roomzo.in">support&#64;roomzo.in</a>.
      </p>

      <h2>2. Information we collect</h2>
      <p>We may collect:</p>
      <ul>
        <li><strong>Account data</strong> — name, email, phone number, and profile details you submit during registration or login (including OTP verification).</li>
        <li><strong>Listing data</strong> — property descriptions, photos, rent, location, amenities, and contact numbers owners upload.</li>
        <li><strong>Communications</strong> — messages you send via contact forms, reports, support emails, or in-product consent records.</li>
        <li><strong>Usage data</strong> — pages viewed, search filters, device/browser type, approximate location if you share it, IP address, and cookies or similar technologies.</li>
        <li><strong>Safety &amp; activity signals</strong> — actions such as viewing a listing, contacting an owner, or submitting a report, used to improve safety and product quality.</li>
      </ul>

      <h2>3. How we use information</h2>
      <ul>
        <li>To operate accounts, listings, search, favourites, and owner contact features.</li>
        <li>To send OTPs, service emails, and respond to support requests.</li>
        <li>To moderate listings, investigate reports of fraud or misuse, and improve safety messaging.</li>
        <li>To analyse traffic and product performance (including tools such as Google Analytics where enabled).</li>
        <li>To show advertising (including Google AdSense) and measure ad performance, subject to your ad settings.</li>
        <li>To enforce our Terms and comply with applicable law.</li>
      </ul>

      <h2>4. Legal bases &amp; sharing</h2>
      <p>
        We process data to provide the service you request, to pursue legitimate interests such as security and
        product improvement, and where required by law. We may share limited information with:
      </p>
      <ul>
        <li>Hosting, email, analytics, notification, and infrastructure providers who process data on our instructions.</li>
        <li>Advertising partners such as Google (see Advertising section below).</li>
        <li>Authorities when legally required, or to protect users against serious fraud or harm.</li>
      </ul>
      <p>We do not sell personal information as a business model.</p>

      <h2>5. Cookies, analytics &amp; Google AdSense</h2>
      <p>
        Roomzo uses cookies and similar technologies for essential site functions, preferences, analytics, and
        advertising. Third-party vendors, including Google, use cookies to serve ads based on a user’s prior visits
        to this or other websites.
      </p>
      <ul>
        <li>Google’s use of advertising cookies enables Google and its partners to serve ads based on visits to Roomzo and/or other sites on the Internet.</li>
        <li>Users may opt out of personalized advertising by visiting
          <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>.
        </li>
        <li>You can also visit
          <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer">www.aboutads.info</a>
          for more opt-out information from participating companies.
        </li>
      </ul>
      <p>
        For details on how Google uses data, see
        <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">How Google uses information from sites or apps that use our services</a>.
      </p>

      <h2>6. Data retention</h2>
      <p>
        We retain account and listing data while your account remains active and for a reasonable period afterward
        for security, dispute handling, and legal compliance. You may request deletion of account data by contacting
        support; some records may be retained where required (for example, fraud investigations or legal obligations).
      </p>

      <h2>7. Security</h2>
      <p>
        We use reasonable technical and organisational measures to protect personal data. No online service is
        completely secure — please use strong passwords and never share OTPs with anyone claiming to be Roomzo staff.
      </p>

      <h2>8. Children’s privacy</h2>
      <p>
        Roomzo is intended for adults seeking or listing rental housing. We do not knowingly collect personal
        information from children under 13. If you believe a child has provided data, contact us to remove it.
      </p>

      <h2>9. Your choices &amp; rights</h2>
      <p>Depending on applicable law, you may request access, correction, or deletion of personal data we hold about you, or object to certain processing. Contact <a href="mailto:support&#64;roomzo.in">support&#64;roomzo.in</a>. You may also control cookies via your browser settings (note: disabling cookies can affect site features).</p>

      <h2>10. International visitors</h2>
      <p>
        Roomzo primarily serves users in India. If you access the site from another country, your information may be
        processed in India or in locations where our service providers operate.
      </p>

      <h2>11. Changes</h2>
      <p>
        We may update this Privacy Policy from time to time. The “Last Updated” date will change when we do. Continued
        use of Roomzo after updates means you accept the revised policy.
      </p>

      <h2>12. Contact</h2>
      <p>
        Privacy requests: <a href="mailto:support&#64;roomzo.in">support&#64;roomzo.in</a><br />
        Website: <a href="https://www.roomzo.in">https://www.roomzo.in</a><br />
        Service focus: rental listings across cities including Prayagraj, Varanasi, Pune, and Lucknow (India).
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
export default class PrivacyPolicyComponent {}
