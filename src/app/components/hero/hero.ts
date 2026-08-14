import { Component, AfterViewInit, ElementRef, ViewChild, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { gsap } from 'gsap';
import { Router } from '@angular/router';
import { MatIcon } from "@angular/material/icon";
import { SearchBarComponent } from "../search-bar/search-bar";

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [CommonModule, MatIcon, SearchBarComponent],
  templateUrl: './hero.html',
  styleUrls: ['./hero.css']
})
export class HeroComponent implements AfterViewInit {
  location: any;
  propertyType: any;

  @ViewChild('heroText', { static: false }) heroText?: ElementRef<HTMLDivElement>;
  @ViewChild('lottieContainer', { static: false }) lottieContainer?: ElementRef<HTMLDivElement>;

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  onSearch() {
    throw new Error('Method not implemented.');
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const tl = gsap.timeline();

      if (this.heroText?.nativeElement) {
        tl.from(this.heroText.nativeElement, { y: 20, autoAlpha: 0, duration: 0.7, ease: 'power2.out' });
      }

      if (this.lottieContainer?.nativeElement) {
        tl.from(this.lottieContainer.nativeElement, { x: 40, autoAlpha: 0, duration: 0.9, ease: 'power2.out' }, '-=0.4');
        gsap.to(this.lottieContainer.nativeElement, { y: -8, repeat: -1, yoyo: true, duration: 3, ease: 'sine.inOut', delay: 0.6 });
      }

      const initLottie = (lottieLib: any) => {
        try {
          if (!this.lottieContainer?.nativeElement) return;
          lottieLib.loadAnimation({
            container: this.lottieContainer.nativeElement,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: 'https://assets10.lottiefiles.com/packages/lf20_jcikwtux.json'
          });
        } catch (e) {}
      };

      const win = window as any;
      if (win.lottie) {
        initLottie(win.lottie);
      } else {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.10.1/lottie.min.js';
        script.async = true;
        script.onload = () => initLottie((window as any).lottie);
        document.body.appendChild(script);
      }
    }
  }

  goToExploreListing() {
    this.router.navigate(['/explore-listing']);
  }
}