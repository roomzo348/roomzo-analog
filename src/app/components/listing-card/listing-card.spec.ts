import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ListingCardComponent } from './listing-card';

describe('ListingCardComponent', () => {
  let fixture: ComponentFixture<ListingCardComponent>;
  let component: ListingCardComponent;

  const baseListing = {
    id: 1,
    title: 'Cozy room',
    location: 'Prayagraj',
    price: 6500,
    image: 'https://example.com/room.jpg',
    specs: { beds: 1, baths: 1, area: 450 },
    badge: { text: 'Available', color: 'green' as const },
    postedDate: '2024-01-01',
    isRented: false,
  };

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ListingCardComponent],
      providers: [provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(ListingCardComponent);
    component = fixture.componentInstance;
    component.listing = { ...baseListing };
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should reflect favorite state from cached ids', () => {
    localStorage.setItem('roomzo_favorite_ids', JSON.stringify(['1']));
    component.ngDoCheck();
    expect(component.isSaved).toBe(true);
  });

  it('should render compact layout with type and city pills', () => {
    localStorage.clear();
    const compactFixture = TestBed.createComponent(ListingCardComponent);
    const compactCard = compactFixture.componentInstance;
    compactCard.compact = true;
    compactCard.listing = {
      ...baseListing,
      propertyType: 'Room',
      city: 'Prayagraj',
      price: 8500,
    };
    compactFixture.detectChanges();

    const el: HTMLElement = compactFixture.nativeElement;
    expect(el.querySelector('.media-pills')).toBeTruthy();
    expect(el.querySelector('.type-pill')?.textContent?.trim()).toBe('Room');
    expect(el.querySelector('.city-pill')?.textContent?.trim()).toBe('Prayagraj');
    expect(el.querySelector('.compact-price .price-value')?.textContent?.trim()).toContain('8,500');
  });
});
