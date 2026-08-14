import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { PropertyService } from './property.service';

describe('PropertyService favorites', () => {
  let service: PropertyService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(PropertyService);
    localStorage.clear();
  });

  it('should read favorite property ids from local storage', () => {
    localStorage.setItem('roomzo_favorite_ids', JSON.stringify(['12', '34']));

    const ids = service.getFavoritePropertyIds();

    expect(ids).toEqual(['12', '34']);
  });
});
