import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListingCardComponent } from './listing-card';

describe('ListingCardComponent', () => {
  let fixture: ComponentFixture<ListingCardComponent>;
  let component: ListingCardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListingCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ListingCardComponent);
    component = fixture.componentInstance;
    component.listing = {
      id: 1,
      title: 'Cozy room',
      location: 'Prayagraj',
      price: 6500,
      image: 'https://example.com/room.jpg',
      specs: { beds: 1, baths: 1, area: 450 },
      postedDate: '2024-01-01',
      isRented: false,
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should reflect favorite state from the listing input', () => {
    component.listing.isFavorite = true;
    fixture.detectChanges();

    expect(component.isSaved).toBe(true);
  });
});
