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
    <div class="blog-landing-page" style="padding: 100px 20px; max-width: 1200px; margin: 0 auto; min-height: 80vh; font-family: var(--font-sans); background: var(--rz-bg); color: var(--rz-text-main);">
      <h1 style="font-size: 2.5rem; margin-bottom: 40px; text-align: center; color: var(--rz-text-main);">Roomzo Blog</h1>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 32px;">
        
        <a *ngFor="let post of posts" [routerLink]="['/blog', post.slug]" 
           style="text-decoration: none; color: inherit; background: var(--rz-bg-card); border-radius: 16px; overflow: hidden; box-shadow: var(--rz-shadow-sm); display: flex; flex-direction: column; transition: transform 0.2s; border: 1px solid var(--rz-border);">
          
          <img [src]="post.imageUrl" style="width: 100%; height: 220px; object-fit: cover;">
          
          <div style="padding: 24px; display: flex; flex-direction: column; flex: 1;">
            <h2 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 12px; color: var(--rz-text-main); text-align: left;">{{ post.title }}</h2>
            <p style="color: var(--rz-text-muted); font-size: 0.95rem; line-height: 1.5; margin-bottom: 24px; flex: 1;">{{ post.excerpt }}</p>
            
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--rz-border); padding-top: 16px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 28px; height: 28px; background: var(--rz-primary); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700;">{{ post.author.charAt(0) }}</div>
                <span style="font-weight: 600; font-size: 0.85rem; color: var(--rz-text-muted);">{{ post.author }}</span>
              </div>
              <span style="color: var(--rz-text-faint); font-size: 0.85rem;">{{ post.date }}</span>
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