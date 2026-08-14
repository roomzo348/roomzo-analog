import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterLink } from '@angular/router';
import { RouteMeta } from '@analogjs/router';

export const routeMeta: RouteMeta = {
  title: 'About Roomzo | Owner-listed Rentals Platform',
  meta: [
    {
      name: 'description',
      content:
        'Learn what Roomzo is: an Indian rental listing platform connecting tenants with property owners for rooms, PGs, and flats — with safety tips and city guides.',
    },
  ],
};

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, RouterLink],
  templateUrl: './about.html',
  styleUrls: ['./about.css']
})
export default class AboutComponent {
constructor(private router: Router) {}

  values = [
    { 
      icon: 'visibility', 
      title: 'Transparency', 
      desc: 'Clear role as a listing platform. Direct owner contact. No hidden Roomzo brokerage for browsing or calling through the site.' 
    },
    { 
      icon: 'verified_user', 
      title: 'Safety-first habits', 
      desc: 'We remind users to visit before paying and to report suspicious listings. Caution beats rushed advances.' 
    },
    { 
      icon: 'lightbulb', 
      title: 'Useful tools', 
      desc: 'City guides, filters, favourites, and educational articles so renting decisions are better informed.' 
    }
  ];

  goToContact() {
this.router.navigate(['/'], { fragment: 'contactUs' });
  }
}