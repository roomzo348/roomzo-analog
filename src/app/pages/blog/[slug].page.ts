import { Component, OnInit, OnDestroy, Inject, Renderer2 } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Meta, Title, DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { BlogPost, BLOG_POSTS } from '../../services/blog-contents';

@Component({
  selector: 'app-blog-detail',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink],
  templateUrl: './[slug].page.html',
  styleUrls: ['./[slug].page.css']
})
export default class BlogPageComponent implements OnInit, OnDestroy {
  post: BlogPost | undefined;
  safeContent: SafeHtml | undefined;
  recentPosts: BlogPost[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private titleService: Title,
    private metaService: Meta,
    private sanitizer: DomSanitizer,
    @Inject(DOCUMENT) private document: Document,
    private renderer: Renderer2
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      this.post = BLOG_POSTS.find(p => p.slug === slug);

      if (this.post) {
        // Bypass security safely because we control the hardcoded HTML in the TS file
        this.safeContent = this.sanitizer.bypassSecurityTrustHtml(this.post.content);
        
        // Load sidebar suggestions
        this.recentPosts = BLOG_POSTS.filter(p => p.id !== this.post?.id).slice(0, 3);
        
        this.updateSeoTags();
        this.injectArticleSchema();
        
        // Scroll to top on new article load
        if (typeof window !== 'undefined') window.scrollTo(0, 0);
      } else {
        // Redirect to a 404 or blog listing page if slug doesn't match
        this.router.navigate(['/']); 
      }
    });
  }

  ngOnDestroy() {
    this.removeArticleSchema();
  }

  // --- PERFECT SEO: Dynamically update Meta Tags for Google ---
  private updateSeoTags() {
    if (!this.post) return;
    
    this.titleService.setTitle(`${this.post.title} | Roomzo Blog`);
    
    this.metaService.updateTag({ name: 'description', content: this.post.excerpt });
    this.metaService.updateTag({ property: 'og:title', content: this.post.title });
    this.metaService.updateTag({ property: 'og:description', content: this.post.excerpt });
    this.metaService.updateTag({ property: 'og:image', content: this.post.imageUrl });
    this.metaService.updateTag({ property: 'og:type', content: 'article' });
  }

  // --- PERFECT SEO: Google Article JSON-LD Schema ---
  private injectArticleSchema() {
    this.removeArticleSchema(); // Clear any existing

    if (!this.post) return;

    const schema = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": this.post.title,
      "image": [this.post.imageUrl],
      "datePublished": new Date(this.post.date).toISOString(),
      "author": [{
          "@type": "Organization",
          "name": this.post.author,
          "url": "https://www.roomzo.in"
      }]
    };

    const script = this.renderer.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'roomzo-article-schema';
    script.text = JSON.stringify(schema);
    this.renderer.appendChild(this.document.head, script);
  }

  private removeArticleSchema() {
    const existingScript = this.document.getElementById('roomzo-article-schema');
    if (existingScript) {
      this.renderer.removeChild(this.document.head, existingScript);
    }
  }
}