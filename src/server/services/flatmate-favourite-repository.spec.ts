import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlQuery = vi.fn();
const sqlExecute = vi.fn();
const getFlatmatePostsByIds = vi.fn();

vi.mock('../db/mysql', () => ({
  sqlQuery: (...args: unknown[]) => sqlQuery(...args),
  sqlExecute: (...args: unknown[]) => sqlExecute(...args),
}));

vi.mock('./flatmate-repository', () => ({
  getFlatmatePostsByIds: (...args: unknown[]) => getFlatmatePostsByIds(...args),
}));

const { getFlatmateFavouritesByUser } = await import('./flatmate-favourite-repository');

describe('getFlatmateFavouritesByUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqlExecute.mockResolvedValue({ affectedRows: 1 });
    sqlQuery.mockResolvedValue([{ favouriteId: 3, postId: 11, savedOn: '2026-09-09' }]);
    getFlatmatePostsByIds.mockResolvedValue([{ id: 11, name: 'Anshu', budget: '1800' }]);
  });

  it('returns saved flatmate posts in favourite order', async () => {
    const [favourite] = await getFlatmateFavouritesByUser(7);

    expect(getFlatmatePostsByIds).toHaveBeenCalledWith([11]);
    expect(favourite.favouriteId).toBe(3);
    expect(favourite.type).toBe('flatmate');
    expect(favourite.flatmate.name).toBe('Anshu');
  });

  it('drops favourites whose posts are no longer active', async () => {
    getFlatmatePostsByIds.mockResolvedValue([]);
    await expect(getFlatmateFavouritesByUser(7)).resolves.toEqual([]);
  });
});
