import { buildQueryString } from './query-string';

describe('buildQueryString', () => {
  it('returns an empty string for no params', () => {
    expect(buildQueryString(undefined)).toBe('');
    expect(buildQueryString({})).toBe('');
    expect(buildQueryString({ search: '', page: undefined, sort: null })).toBe('');
  });

  it('serializes scalars and booleans as 1/0', () => {
    expect(buildQueryString({ page: 2, unread: true, pending: false })).toBe(
      '?page=2&unread=1&pending=0',
    );
  });

  it('serializes filters as filter[key] with comma-joined lists', () => {
    const query = buildQueryString({
      filter: { status: ['available', 'reserved'], branch_id: 3, brand_id: undefined, year: [] },
    });

    expect(decodeURIComponent(query)).toBe(
      '?filter[status]=available,reserved&filter[branch_id]=3',
    );
  });

  it('encodes Arabic search terms', () => {
    const query = buildQueryString({ search: 'أحمد' });
    expect(new URLSearchParams(query).get('search')).toBe('أحمد');
  });
});
