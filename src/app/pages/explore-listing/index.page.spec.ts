import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import ExploreListingsComponent from './index.page';

describe('ExploreListingsComponent default sort', () => {
  function createComponent() {
    const propertyService = {
      searchListingsWithFilters: vi.fn().mockReturnValue(of({
        listings: [],
        totalItems: 0,
        totalPages: 0,
      })),
    };
    const activityService = { logSearch: vi.fn() };
    const cd = { detectChanges: vi.fn(), markForCheck: vi.fn() };
    const contactAccess = {
      paywallOpened$: of(),
      isPaywallOpen: () => false,
    };

    const component = new ExploreListingsComponent(
      propertyService as any,
      activityService as any,
      cd as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      'server',
      {} as any,
      { warning: vi.fn() } as any,
      contactAccess as any,
    );

    return { component, propertyService };
  }

  it('defaults to latest-first sorting', () => {
    const { component } = createComponent();

    expect(component.filters.sortBy).toBe('latest');
    expect(component.getSortLabel()).toBe('Latest First');
  });

  it('switches to nearest-first only after the user selects it', () => {
    const { component, propertyService } = createComponent();

    component.selectSort('nearest');

    expect(component.filters.sortBy).toBe('nearest');
    expect(component.getSortLabel()).toBe('Nearest First');
    expect(propertyService.searchListingsWithFilters).toHaveBeenCalled();
    const filters = propertyService.searchListingsWithFilters.mock.calls.at(-1)?.[2];
    expect(filters.sortBy).toBe('nearest');
  });

  it('keeps latest-first after a location is selected from suggestions', () => {
    const { component } = createComponent();

    component.onCitySelected({
      option: {
        value: {
          lat: '25.4358',
          lon: '81.8463',
          name: 'Civil Lines',
          roomzoCity: 'Prayagraj',
          roomzoSource: 'zone',
          address: { city: 'Prayagraj', state: 'Uttar Pradesh' },
        },
      },
    });

    expect(component.filters.sortBy).toBe('latest');
    expect(component.getSortLabel()).toBe('Latest First');
  });

  it('does not override nearest-first when searching after the user selected it', () => {
    const { component } = createComponent();
    component.filters.sortBy = 'nearest';

    component.quickSearch('Civil Lines', 'Uttar Pradesh');

    expect(component.filters.sortBy).toBe('nearest');
  });

  it('restores latest-first when filters are reset', () => {
    const { component } = createComponent();
    component.filters.sortBy = 'nearest';

    component.resetFilters();

    expect(component.filters.sortBy).toBe('latest');
    expect(component.getSortLabel()).toBe('Latest First');
  });
});
