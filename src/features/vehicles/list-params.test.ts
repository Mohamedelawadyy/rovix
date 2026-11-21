import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  hasActiveFilters,
  parseVehicleListParams,
  toSearchParams,
} from './list-params';

const parse = (query: string) => parseVehicleListParams(new URLSearchParams(query));

describe('vehicle list params', () => {
  it('uses defaults for an empty URL', () => {
    expect(parse('')).toEqual({
      page: 1,
      per_page: DEFAULT_PAGE_SIZE,
      sort: DEFAULT_SORT,
      filter: {},
    });
    expect(hasActiveFilters(parse(''))).toBe(false);
  });

  it('reads valid search, filters, sort and paging', () => {
    expect(
      parse(
        'search=%20corolla%20&status=available&brand_id=3&model_id=9&branch_id=2&year=2024&fuel_type=hybrid&transmission=cvt&vehicle_type=suv&sort=-selling_price&page=4&per_page=50',
      ),
    ).toEqual({
      page: 4,
      per_page: 50,
      sort: '-selling_price',
      search: 'corolla',
      filter: {
        status: 'available',
        brand_id: 3,
        model_id: 9,
        branch_id: 2,
        year: 2024,
        fuel_type: 'hybrid',
        transmission: 'cvt',
        vehicle_type: 'suv',
      },
    });
  });

  it('drops values the backend would reject instead of sending them', () => {
    expect(
      parse(
        'status=flying&brand_id=abc&branch_id=-1&year=1800&sort=price;drop&page=0&per_page=7&color=red',
      ),
    ).toEqual({ page: 1, per_page: DEFAULT_PAGE_SIZE, sort: DEFAULT_SORT, filter: {} });
  });

  it('ignores a model without its brand', () => {
    expect(parse('model_id=9').filter).toEqual({});
  });

  it('round-trips to a minimal URL', () => {
    const params = parse('status=sold&brand_id=3&sort=-created_at&page=1&per_page=15');
    expect(toSearchParams(params).toString()).toBe('status=sold&brand_id=3');
    expect(parse(toSearchParams(params).toString())).toEqual(params);
  });
});
