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
      <span class="shine" aria-hidden="true"></span>
      <mat-icon aria-hidden="true">card_giftcard</mat-icon>
      Get 3 free points
    </button>
  `,
  styles: [`
    :host { display: inline-flex; }
    .get-free-points {
      position: relative;
      overflow: hidden;
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
    .shine {
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,.45), transparent 70%);
      transform: translateX(-80%);
      animation: rewardShine 3.2s ease-in-out infinite;
    }
    mat-icon { font-size: 18px; width: 18px; height: 18px; animation: rewardGift 2.4s ease-in-out infinite; }
    @keyframes rewardShine {
      0%, 55% { transform: translateX(-80%); opacity: 0; }
      70% { opacity: 1; }
      100% { transform: translateX(80%); opacity: 0; }
    }
    @keyframes rewardGift {
      0%, 100% { transform: rotate(-8deg); }
      50% { transform: rotate(8deg); }
    }
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
