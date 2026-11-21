import { ApiError } from './errors';
import { apiSession } from './session';

describe('apiSession', () => {
  afterEach(() => {
    apiSession.setToken(null);
  });

  it('stores the token in memory', () => {
    expect(apiSession.getToken()).toBeNull();
    apiSession.setToken('abc');
    expect(apiSession.getToken()).toBe('abc');
  });

  it('broadcasts 401s to subscribers until they unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = apiSession.onUnauthenticated(listener);
    const error = new ApiError({
      kind: 'unauthenticated',
      status: 401,
      message: 'Unauthenticated.',
    });

    apiSession.notifyUnauthenticated(error);
    unsubscribe();
    apiSession.notifyUnauthenticated(error);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(error);
  });
});
