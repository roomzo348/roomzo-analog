import MyListingsComponent from './index.page';

describe('MyListingsComponent favorites normalization', () => {
  it('normalizes nested favorite payload into a renderable listing', () => {
    const component = new MyListingsComponent(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

    const normalized = component.normalizeFavoriteListing({
      favouriteId: 'fav-1',
      property: {
        id: 42,
        propertyName: 'Bright Flat',
        rentAmount: 12000,
        bedrooms: 2,
        propertySize: 850,
        city: 'Noida',
        state: 'UP',
        photos: [{ photoUrl: 'https://example.com/flat.jpg' }],
        dateCreated: '2024-01-01',
        propertyType: 'Apartment'
      }
    });

    expect(normalized).toMatchObject({
      id: 42,
      propertyName: 'Bright Flat',
      rentAmount: 12000,
      bedrooms: 2,
      propertySize: 850,
      city: 'Noida',
      state: 'UP',
      photos: [{ photoUrl: 'https://example.com/flat.jpg' }],
      dateCreated: '2024-01-01',
      propertyType: 'Apartment'
    });
  });
});
