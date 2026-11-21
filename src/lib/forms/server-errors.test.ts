import { ApiError } from '@/lib/api';
import { applyServerErrors } from './server-errors';

const validation = (fieldErrors: Record<string, string[]>) =>
  new ApiError({ kind: 'validation', status: 422, message: 'invalid', fieldErrors });

describe('applyServerErrors', () => {
  it('sets known fields, focuses the first, and returns the rest', () => {
    const setError = vi.fn();
    const rest = applyServerErrors(
      validation({
        vin: ['VIN taken.'],
        'specifications.color': ['Too long.'],
        status: ['Use the workflow.'],
      }),
      setError,
      ['vin', 'specifications'],
    );

    expect(setError).toHaveBeenNthCalledWith(
      1,
      'vin',
      { type: 'server', message: 'VIN taken.' },
      { shouldFocus: true },
    );
    expect(setError).toHaveBeenNthCalledWith(
      2,
      'specifications',
      { type: 'server', message: 'Too long.' },
      { shouldFocus: false },
    );
    expect(rest).toEqual(['Use the workflow.']);
  });

  it('ignores non-validation errors', () => {
    const setError = vi.fn();
    expect(
      applyServerErrors(new ApiError({ kind: 'conflict', status: 409, message: 'x' }), setError, [
        'vin',
      ]),
    ).toEqual([]);
    expect(applyServerErrors(new Error('boom'), setError, ['vin'])).toEqual([]);
    expect(setError).not.toHaveBeenCalled();
  });
});
