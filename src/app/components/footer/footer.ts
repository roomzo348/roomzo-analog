import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { RelatedSearchesComponent } from "../related-searches/related-searches";
import { getActiveCities, buildCityPath } from '../../config/cities.config';
import { ROOMZO_CATEGORIES, buildCategoryPath } from '../../config/categories.config';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, RelatedSearchesComponent],
  templateUrl: './footer.html',
  styleUrls: ['./footer.css']
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
  activeCities = getActiveCities();
  categories = ROOMZO_CATEGORIES;
  buildCityPath = buildCityPath;
  buildCategoryPath = buildCategoryPath;
}
