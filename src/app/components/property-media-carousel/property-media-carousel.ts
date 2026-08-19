import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  SimpleChanges,
} from '@angular/core';
import { getListingPhotoUrls, ListingPhotoInput, optimizeImageUrl } from '../../utils/image-seo.util';

@Component({
  selector: 'app-property-media-carousel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="media-carousel"
      (mouseenter)="pauseAutoPlay()"
      (mouseleave)="resumeAutoPlay()"
      (touchstart)="pauseAutoPlay()"
      (touchend)="resumeAutoPlay()">
      <div class="media-track" [style.transform]="'translateX(-' + activeIndex * 100 + '%)'">
        <img
          *ngFor="let url of photoUrls; let i = index"
          [src]="optimize(url)"
          [alt]="alt + (photoUrls.length > 1 ? ' — photo ' + (i + 1) : '')"
          loading="lazy"
          decoding="async"
          draggable="false"
        />
      </div>

      <button
        type="button"
        class="nav-arrow nav-prev"
        *ngIf="showNavArrows && photoUrls.length > 1"
        aria-label="Previous photo"
        (click)="prev($event)">
        <span aria-hidden="true">‹</span>
      </button>

      <button
        type="button"
        class="nav-arrow nav-next"
        *ngIf="showNavArrows && photoUrls.length > 1"
        aria-label="Next photo"
        (click)="next($event)">
        <span aria-hidden="true">›</span>
      </button>

      <div class="media-dots" *ngIf="photoUrls.length > 1">
        <button
          type="button"
          *ngFor="let url of photoUrls; let i = index"
          class="media-dot"
          [class.active]="i === activeIndex"
          [attr.aria-label]="'Photo ' + (i + 1)"
          (click)="goTo(i, $event)">
        </button>
      </div>

      <span class="photo-count" *ngIf="photoUrls.length > 1">
        {{ activeIndex + 1 }}/{{ photoUrls.length }}
      </span>
    </div>
  `,
  styles: [
    `
      .media-carousel {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #f8fafc;
      }
      .media-track {
        display: flex;
        height: 100%;
        transition: transform 0.55s cubic-bezier(0.4, 0, 0.2, 1);
        will-change: transform;
      }
      .media-track img {
        min-width: 100%;
        width: 100%;
        height: 100%;
        object-fit: cover;
        flex-shrink: 0;
        user-select: none;
        pointer-events: none;
      }
      .nav-arrow {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        z-index: 3;
        width: 30px;
        height: 30px;
        border: none;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.92);
        color: #0f172a;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(15, 23, 42, 0.18);
        opacity: 0;
        transition: opacity 0.2s ease, transform 0.2s ease, background 0.2s ease;
        padding: 0;
      }
      .nav-arrow span {
        font-size: 1.35rem;
        line-height: 1;
        font-weight: 700;
        margin-top: -2px;
      }
      .media-carousel:hover .nav-arrow,
      .media-carousel:focus-within .nav-arrow {
        opacity: 1;
      }
      .nav-arrow:active {
        transform: translateY(-50%) scale(0.94);
      }
      .nav-prev { left: 8px; }
      .nav-next { right: 8px; }
      .media-dots {
        position: absolute;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 6px;
        z-index: 2;
      }
      .media-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        border: none;
        padding: 0;
        background: rgba(255, 255, 255, 0.55);
        cursor: pointer;
        transition: transform 0.2s, background 0.2s;
      }
      .media-dot.active {
        background: #fff;
        transform: scale(1.25);
      }
      .photo-count {
        position: absolute;
        bottom: 10px;
        right: 10px;
        background: rgba(15, 23, 42, 0.62);
        color: #fff;
        font-size: 0.68rem;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 999px;
        z-index: 2;
        letter-spacing: 0.02em;
      }
      @media (max-width: 900px) {
        .nav-arrow {
          opacity: 1;
          width: 28px;
          height: 28px;
        }
      }
    `,
  ],
})
export class PropertyMediaCarouselComponent implements OnInit, OnChanges, OnDestroy {
  @Input() photos: ListingPhotoInput[] | null = [];
  @Input() singleImage?: string;
  @Input() fallback =
    'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&q=80';
  @Input() alt = 'Property photo';
  @Input() autoPlayMs = 3800;
  @Input() showNavArrows = true;

  photoUrls: string[] = [];
  activeIndex = 0;
  private timer?: ReturnType<typeof setInterval>;
  private isBrowser: boolean;
  private isDestroyed = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private zone: NgZone,
    private cd: ChangeDetectorRef
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.rebuildUrls();
    this.startAutoPlay();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['photos'] || changes['singleImage']) {
      this.rebuildUrls();
      this.activeIndex = 0;
      this.restartAutoPlay();
    }
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.clearTimer();
  }

  optimize(url: string): string {
    return optimizeImageUrl(url);
  }

  goTo(index: number, event?: Event): void {
    event?.stopPropagation();
    if (index < 0 || index >= this.photoUrls.length) return;
    this.activeIndex = index;
    this.cd.markForCheck();
    this.restartAutoPlay();
  }

  prev(event?: Event): void {
    event?.stopPropagation();
    if (this.photoUrls.length <= 1) return;
    this.activeIndex =
      (this.activeIndex - 1 + this.photoUrls.length) % this.photoUrls.length;
    this.cd.markForCheck();
    this.restartAutoPlay();
  }

  next(event?: Event): void {
    event?.stopPropagation();
    if (this.photoUrls.length <= 1) return;
    this.activeIndex = (this.activeIndex + 1) % this.photoUrls.length;
    this.cd.markForCheck();
    this.restartAutoPlay();
  }

  pauseAutoPlay(): void {
    this.clearTimer();
  }

  resumeAutoPlay(): void {
    this.startAutoPlay();
  }

  private rebuildUrls(): void {
    const fromPhotos = getListingPhotoUrls(this.photos, '');
    const hasUsablePhotos = fromPhotos.length > 0 && fromPhotos[0] !== '';

    if (hasUsablePhotos) {
      this.photoUrls = fromPhotos;
      return;
    }

    if (this.singleImage) {
      this.photoUrls = [this.singleImage];
      return;
    }

    this.photoUrls = [this.fallback];
  }

  private startAutoPlay(): void {
    this.clearTimer();
    if (!this.isBrowser || this.photoUrls.length <= 1) return;

    // Stay outside the Angular zone and refresh only this view. Re-entering the
    // zone would run an app-wide change detection pass on every slide and could
    // land mid-pass, which is what produced NG0100 here.
    this.zone.runOutsideAngular(() => {
      this.timer = setInterval(() => {
        if (this.isDestroyed) return;
        this.activeIndex = (this.activeIndex + 1) % this.photoUrls.length;
        this.cd.detectChanges();
      }, this.autoPlayMs);
    });
  }

  private restartAutoPlay(): void {
    this.clearTimer();
    this.startAutoPlay();
  }

  private clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
