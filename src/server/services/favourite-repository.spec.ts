import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlQuery = vi.fn();
const getListingsByIds = vi.fn();
const getRevealableListingIds = vi.fn();

vi.mock('../db/mysql', () => ({
  sqlQuery: (...args: unknown[]) => sqlQuery(...args),
  sqlExecute: vi.fn(),
}));

vi.mock('./listing-repository', () => ({
  getListingsByIds: (...args: unknown[]) => getListingsByIds(...args),
}));

vi.mock('./contact-access-repository', () => ({
  getRevealableListingIds: (...args: unknown[]) => getRevealableListingIds(...args),
}));

const { getFavouritesByUser } = await import('./favourite-repository');

const OWNER_ID = 42;
const SEEKER_ID = 7;

function listing(id: number, ownerId = OWNER_ID) {
  return {
    id,
    ownerId,
    propertyName: `Room ${id}`,
    isRented: 0,
    tempContactNo: '8888888888',
    contactNo: '9999999999',
  };
}

describe('getFavouritesByUser contact gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqlQuery.mockResolvedValue([{ favouriteId: 1, propertyId: 101, savedOn: '2026-08-01' }]);
    getListingsByIds.mockResolvedValue([listing(101)]);
  });

  it('hides owner contact on saved listings that were never paid for', async () => {
    getRevealableListingIds.mockResolvedValue(new Set<number>());

    const [favourite] = await getFavouritesByUser(SEEKER_ID);

    expect(favourite.property.contactUnlocked).toBe(false);
    expect(favourite.property.tempContactNo).toBeUndefined();
    expect(favourite.property.contactNo).toBeUndefined();
    expect(favourite.property.propertyName).toBe('Room 101');
  });

  it('reveals owner contact once the listing is unlocked on an active plan', async () => {
    getRevealableListingIds.mockResolvedValue(new Set<number>([101]));

    const [favourite] = await getFavouritesByUser(SEEKER_ID);

    expect(favourite.property.contactUnlocked).toBe(true);
    expect(favourite.property.tempContactNo).toBe('8888888888');
  });

  it('reveals contact to the owner of the listing without a plan', async () => {
    getRevealableListingIds.mockResolvedValue(new Set<number>());

    const [favourite] = await getFavouritesByUser(OWNER_ID);

    expect(favourite.property.contactUnlocked).toBe(true);
    expect(favourite.property.tempContactNo).toBe('8888888888');
  });

  it('drops rented listings from favourites', async () => {
    getRevealableListingIds.mockResolvedValue(new Set<number>());
    getListingsByIds.mockResolvedValue([{ ...listing(101), isRented: 2 }]);

    await expect(getFavouritesByUser(SEEKER_ID)).resolves.toEqual([]);
  });
});
