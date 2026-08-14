import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BLOG_POSTS, BlogPost } from '../../services/blog-contents'; // Ensure path is correct

@Component({
  selector: 'app-blog-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  // Inline HTML and CSS so you don't have to create extra files
  template: `
    <div class="blog-landing-page" style="padding: 100px 20px; max-width: 1200px; margin: 0 auto; min-height: 80vh; font-family: 'Inter', sans-serif;">
      <h1 style="font-size: 2.5rem; margin-bottom: 40px; text-align: center; color: #111827;">Roomzo Blog</h1>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 32px;">
        
        <a *ngFor="let post of posts" [routerLink]="['/blog', post.slug]" 
           style="text-decoration: none; color: inherit; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); display: flex; flex-direction: column; transition: transform 0.2s; border: 1px solid #e2e8f0;">
          
          <img [src]="post.imageUrl" style="width: 100%; height: 220px; object-fit: cover;">
          
          <div style="padding: 24px; display: flex; flex-direction: column; flex: 1;">
            <h2 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 12px; color: #0f172a;">{{ post.title }}</h2>
            <p style="color: #64748b; font-size: 0.95rem; line-height: 1.5; margin-bottom: 24px; flex: 1;">{{ post.excerpt }}</p>
            
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 16px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 28px; height: 28px; background: #0f766e; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700;">{{ post.author.charAt(0) }}</div>
                <span style="font-weight: 600; font-size: 0.85rem; color: #334155;">{{ post.author }}</span>
              </div>
              <span style="color: #94a3b8; font-size: 0.85rem;">{{ post.date }}</span>
            </div>
          </div>
        </a>

      </div>
    </div>
  `
})
export default class BlogIndexComponent implements OnInit {
  posts: BlogPost[] = [];

  ngOnInit() {
    this.posts = BLOG_POSTS;
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }
}