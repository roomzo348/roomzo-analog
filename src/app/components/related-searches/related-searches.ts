import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { getActiveCities, buildCityPath } from '../../config/cities.config';

export interface RelatedQuery {
  label: string;
  routerLink: string | string[];
  queryParams?: Record<string, string>;
}

@Component({
  selector: 'app-related-searches',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './related-searches.html',
  styleUrls: ['./related-searches.css'],
})
export class RelatedSearchesComponent {
  @Input() cityName?: string;
  @Input() compact = false;

  readonly activeCities = getActiveCities();

  /**
   * Links land on /city/{slug} with optional zone + propertyType query params
   * so the city page selects the matching filter pills.
   */
  get relatedQueries(): RelatedQuery[] {
    const city = this.cityName?.toLowerCase();

    if (city === 'prayagraj' || city === 'allahabad') {
      return [
        this.cityLink('Rooms for Rent in Prayagraj', 'prayagraj', { propertyType: 'Room' }),
        this.cityLink('Room for Rent in Allahabad', 'prayagraj', { propertyType: 'Room' }),
        this.cityLink('PG in Prayagraj', 'prayagraj', { propertyType: 'PG' }),
        this.cityLink('Flats for Rent in Prayagraj', 'prayagraj', { propertyType: 'Flat' }),
        this.cityLink('Boys PG in Prayagraj', 'prayagraj', { propertyType: 'PG' }),
        this.cityLink('Girls PG in Prayagraj', 'prayagraj', { propertyType: 'PG' }),
        this.cityLink('Rooms Near Allahabad University', 'prayagraj', { propertyType: 'Room' }),
        this.cityLink('PG Near Allahabad University', 'prayagraj', { propertyType: 'PG' }),
        this.cityLink('Student Rooms in Prayagraj', 'prayagraj', { propertyType: 'Room' }),
        this.cityLink('Flatmates in Prayagraj', null, null, '/flatmates'),

        // Zone-specific — matches public/data/city-zones.json names
        this.cityLink('Rooms for Rent in Civil Lines Prayagraj', 'prayagraj', { zone: 'Civil Lines', propertyType: 'Room' }),
        this.cityLink('PG in Civil Lines Prayagraj', 'prayagraj', { zone: 'Civil Lines', propertyType: 'PG' }),
        this.cityLink('Flats in Civil Lines Prayagraj', 'prayagraj', { zone: 'Civil Lines', propertyType: 'Flat' }),
        this.cityLink('Rooms for Rent in Katra Prayagraj', 'prayagraj', { zone: 'Katra', propertyType: 'Room' }),
        this.cityLink('PG in Katra Prayagraj', 'prayagraj', { zone: 'Katra', propertyType: 'PG' }),
        this.cityLink('Rooms for Rent in Teliyarganj', 'prayagraj', { zone: 'Teliyarganj', propertyType: 'Room' }),
        this.cityLink('Rooms for Rent in Naini', 'prayagraj', { zone: 'Naini', propertyType: 'Room' }),
        this.cityLink('Rooms for Rent in Jhusi', 'prayagraj', { zone: 'Jhusi', propertyType: 'Room' }),
        this.cityLink('Rooms for Rent in George Town', 'prayagraj', { zone: 'George', propertyType: 'Room' }),
        this.cityLink('Rooms for Rent in Allahpur', 'prayagraj', { zone: 'Allahpur', propertyType: 'Room' }),
        this.cityLink('Rooms for Rent in Phaphamau', 'prayagraj', { zone: 'Phaphamau', propertyType: 'Room' }),
        this.cityLink('Rooms for Rent in Mutthiganj', 'prayagraj', { zone: 'Mutthiganj', propertyType: 'Room' }),
        this.cityLink('Rooms for Rent in Stanley Road', 'prayagraj', { zone: 'Stanley Road', propertyType: 'Room' }),
      ];
    }

    if (city === 'varanasi' || city === 'banaras' || city === 'kashi') {
      return [
        this.cityLink('Rooms for Rent in Varanasi', 'varanasi', { propertyType: 'Room' }),
        this.cityLink('PG in Varanasi', 'varanasi', { propertyType: 'PG' }),
        this.cityLink('Flats for Rent in Varanasi', 'varanasi', { propertyType: 'Flat' }),
        this.cityLink('PG Near BHU', 'varanasi', { propertyType: 'PG' }),
        this.cityLink('Rooms Near BHU Varanasi', 'varanasi', { propertyType: 'Room' }),
        this.cityLink('Student PG in Varanasi', 'varanasi', { propertyType: 'PG' }),
        this.cityLink('Boys PG in Varanasi', 'varanasi', { propertyType: 'PG' }),
        this.cityLink('Girls PG in Varanasi', 'varanasi', { propertyType: 'PG' }),
        this.cityLink('Flatmates in Varanasi', null, null, '/flatmates'),
      ];
    }

    if (city === 'pune') {
      return [
        this.cityLink('Rooms for Rent in Pune', 'pune', { propertyType: 'Room' }),
        this.cityLink('PG in Pune', 'pune', { propertyType: 'PG' }),
        this.cityLink('Flats for Rent in Pune', 'pune', { propertyType: 'Flat' }),
        this.cityLink('Rooms in Viman Nagar Pune', 'pune', { zone: 'Viman Nagar', propertyType: 'Room' }),
        this.cityLink('PG in Viman Nagar Pune', 'pune', { zone: 'Viman Nagar', propertyType: 'PG' }),
        this.cityLink('Flats in Viman Nagar Pune', 'pune', { zone: 'Viman Nagar', propertyType: 'Flat' }),
        this.cityLink('Rooms in Koregaon Park Pune', 'pune', { zone: 'Koregaon Park', propertyType: 'Room' }),
        this.cityLink('PG in Koregaon Park Pune', 'pune', { zone: 'Koregaon Park', propertyType: 'PG' }),
        this.cityLink('Boys PG in Pune', 'pune', { propertyType: 'PG' }),
        this.cityLink('Girls PG in Pune', 'pune', { propertyType: 'PG' }),
        this.cityLink('Flatmates in Pune', null, null, '/flatmates'),
      ];
    }

    if (city === 'lucknow') {
      return [
        this.cityLink('Rooms for Rent in Lucknow', 'lucknow', { propertyType: 'Room' }),
        this.cityLink('PG in Lucknow', 'lucknow', { propertyType: 'PG' }),
        this.cityLink('Flats for Rent in Lucknow', 'lucknow', { propertyType: 'Flat' }),
        this.cityLink('Boys PG in Lucknow', 'lucknow', { propertyType: 'PG' }),
        this.cityLink('Girls PG in Lucknow', 'lucknow', { propertyType: 'PG' }),
        this.cityLink('Student Rooms in Lucknow', 'lucknow', { propertyType: 'Room' }),
        this.cityLink('Flatmates in Lucknow', null, null, '/flatmates'),
      ];
    }

    if (city) {
      const conf = getActiveCities().find((c) => c.name.toLowerCase() === city);
      const slug = conf?.slug ?? city;
      const name = this.cityName ?? conf?.name ?? city;
      return [
        this.cityLink(`Rooms for Rent in ${name}`, slug, { propertyType: 'Room' }),
        this.cityLink(`PG in ${name}`, slug, { propertyType: 'PG' }),
        this.cityLink(`Flats for Rent in ${name}`, slug, { propertyType: 'Flat' }),
        this.cityLink(`Boys PG in ${name}`, slug, { propertyType: 'PG' }),
        this.cityLink(`Girls PG in ${name}`, slug, { propertyType: 'PG' }),
        this.cityLink(`Student Rooms in ${name}`, slug, { propertyType: 'Room' }),
        this.cityLink(`Flatmates in ${name}`, null, null, '/flatmates'),
      ];
    }

    // Global / footer default — city landings with type filters
    return [
      this.cityLink('Rooms for Rent in Prayagraj', 'prayagraj', { propertyType: 'Room' }),
      this.cityLink('Rooms in Civil Lines Prayagraj', 'prayagraj', { zone: 'Civil Lines', propertyType: 'Room' }),
      this.cityLink('PG in Prayagraj', 'prayagraj', { propertyType: 'PG' }),
      this.cityLink('Rooms for Rent in Varanasi', 'varanasi', { propertyType: 'Room' }),
      this.cityLink('PG Near BHU Varanasi', 'varanasi', { propertyType: 'PG' }),
      this.cityLink('Flats for Rent in Pune', 'pune', { propertyType: 'Flat' }),
      this.cityLink('PG in Viman Nagar Pune', 'pune', { zone: 'Viman Nagar', propertyType: 'PG' }),
      this.cityLink('Rooms for Rent in Lucknow', 'lucknow', { propertyType: 'Room' }),
      this.cityLink('Find Flatmates', null, null, '/flatmates'),
    ];
  }

  cityPath = buildCityPath;

  private cityLink(
    label: string,
    slug: string | null,
    queryParams: Record<string, string> | null,
    absolutePath?: string
  ): RelatedQuery {
    if (absolutePath) {
      return { label, routerLink: absolutePath };
    }
    return {
      label,
      routerLink: ['/city', slug!],
      queryParams: queryParams ?? undefined,
    };
  }
}
