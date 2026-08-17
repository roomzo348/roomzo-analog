import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ListingCardComponent } from './listing-card';

describe('ListingCardComponent', () => {
  let fixture: ComponentFixture<ListingCardComponent>;
  let component: ListingCardComponent;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ListingCardComponent],
      providers: [provideHttpClient()],
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
      badge: { text: 'Available', color: 'green' },
      postedDate: '2024-01-01',
      isRented: false,
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should reflect favorite state from cached ids', () => {
    localStorage.setItem('roomzo_favorite_ids', JSON.stringify(['1']));
    component.ngDoCheck();
    expect(component.isSaved).toBe(true);
  });
});
