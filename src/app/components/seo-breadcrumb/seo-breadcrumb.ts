import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

@Component({
  selector: 'app-seo-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './seo-breadcrumb.html',
  styleUrls: ['./seo-breadcrumb.css'],
})
export class SeoBreadcrumbComponent {
  @Input() items: BreadcrumbItem[] = [];
}
