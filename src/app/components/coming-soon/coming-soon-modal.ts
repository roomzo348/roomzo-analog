import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-coming-soon-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './coming-soon-modal.html',
  styleUrls: ['./coming-soon-modal.css'],
})
export class ComingSoonModalComponent {
  readonly liveCities = [
    { name: 'Prayagraj', icon: 'account_balance' },
    { name: 'Varanasi', icon: 'temple_hindu' },
    { name: 'Lucknow', icon: 'location_city' },
    { name: 'Pune', icon: 'apartment' },
  ];

  readonly stats = [
    { icon: 'home', value: '500+', label: 'Listings' },
    { icon: 'group', value: '1000+', label: 'Users' },
    { icon: 'location_city', value: '4+', label: 'Cities' },
    { icon: 'trending_up', value: '50K+', label: 'Visitors' },
  ];

  constructor(
    public dialogRef: MatDialogRef<ComingSoonModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  close(): void {
    this.dialogRef.close();
  }
}
