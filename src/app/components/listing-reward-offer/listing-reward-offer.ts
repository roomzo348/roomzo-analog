import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-listing-reward-offer',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <button type="button" class="get-free-points" (click)="go()">
      <mat-icon aria-hidden="true">card_giftcard</mat-icon>
      Get free points
    </button>
  `,
  styles: [`
    :host { display: inline-flex; }
    .get-free-points {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid color-mix(in srgb, #0f766e 35%, transparent);
      background: color-mix(in srgb, #0f766e 10%, var(--rz-bg-card, #fff));
      color: #0f766e;
      border-radius: 999px;
      padding: 8px 14px;
      font: inherit;
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
    }
    mat-icon { font-size: 18px; width: 18px; height: 18px; }
    :host-context([data-theme='dark']) .get-free-points {
      color: #5eead4;
      background: rgba(20, 184, 166, 0.12);
      border-color: rgba(94, 234, 212, 0.35);
    }
  `],
})
export class ListingRewardOfferComponent {
  @Output() clicked = new EventEmitter<void>();

  constructor(private router: Router) {}

  go(): void {
    void this.router.navigate(['/earn-points']);
    this.clicked.emit();
  }
}
