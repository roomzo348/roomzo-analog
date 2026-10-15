import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { RouteMeta } from '@analogjs/router';
import { PropertyService } from '../../services/property.service';

export const routeMeta: RouteMeta = {
  title: 'Get free contact points | Roomzo',
  meta: [
    {
      name: 'description',
      content:
        'List a genuine property. After Roomzo approval it goes live and you receive free contact points.',
    },
  ],
};

@Component({
  selector: 'app-earn-points',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './earn-points.html',
  styleUrls: ['./earn-points.css'],
})
export default class EarnPointsPage implements OnInit {
  credits = 3;
  rupees = 19;

  constructor(
    private propertyService: PropertyService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.propertyService.getListingRewardConfig().subscribe((cfg) => {
      this.credits = cfg.credits;
      this.rupees = cfg.rupees;
      this.cd.detectChanges();
    });
  }
}
