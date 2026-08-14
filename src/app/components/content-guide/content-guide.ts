import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GuideSection } from '../../content/city-guides';

/**
 * Renders long-form educational sections for AdSense / content quality.
 */
@Component({
  selector: 'app-content-guide',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="rz-content-guide" *ngIf="intro || (sections && sections.length)">
      <header class="guide-header" *ngIf="title || tagline || intro">
        <p class="guide-kicker" *ngIf="kicker">{{ kicker }}</p>
        <h2 *ngIf="title">{{ title }}</h2>
        <p class="guide-tagline" *ngIf="tagline">{{ tagline }}</p>
        <p class="guide-intro" *ngIf="intro">{{ intro }}</p>
      </header>

      <section class="guide-section" *ngFor="let section of sections">
        <h3>{{ section.heading }}</h3>
        <p *ngFor="let p of section.paragraphs">{{ p }}</p>
        <ul *ngIf="section.bullets?.length">
          <li *ngFor="let b of section.bullets">{{ b }}</li>
        </ul>
      </section>
    </article>
  `,
  styles: [
    `
      .rz-content-guide {
        max-width: 920px;
        margin: 48px auto 24px;
        padding: 28px 24px;
        background: #fff;
        border: 1px solid rgba(15, 23, 42, 0.08);
        border-radius: 16px;
        color: #0f172a;
        line-height: 1.7;
      }
      .guide-kicker {
        font-size: 0.75rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #64748b;
        margin: 0 0 8px;
        font-weight: 600;
      }
      .guide-header h2 {
        font-size: 1.5rem;
        margin: 0 0 8px;
        line-height: 1.3;
      }
      .guide-tagline {
        color: #475569;
        margin: 0 0 12px;
        font-size: 1.05rem;
      }
      .guide-intro {
        margin: 0;
        color: #334155;
        font-size: 1.02rem;
      }
      .guide-section {
        margin-top: 28px;
        padding-top: 8px;
        border-top: 1px solid rgba(15, 23, 42, 0.06);
      }
      .guide-section h3 {
        font-size: 1.15rem;
        margin: 0 0 10px;
        color: #0f172a;
      }
      .guide-section p {
        margin: 0 0 12px;
        color: #475569;
        font-size: 1rem;
      }
      .guide-section ul {
        margin: 8px 0 0;
        padding-left: 1.2rem;
        color: #475569;
      }
      .guide-section li {
        margin-bottom: 8px;
      }
      @media (max-width: 600px) {
        .rz-content-guide {
          margin: 32px 0 16px;
          padding: 20px 16px;
          border-radius: 12px;
        }
        .guide-header h2 {
          font-size: 1.25rem;
        }
      }
    `,
  ],
})
export class ContentGuideComponent {
  @Input() kicker = 'Rental guide';
  @Input() title = '';
  @Input() tagline = '';
  @Input() intro = '';
  @Input() sections: GuideSection[] = [];
}
