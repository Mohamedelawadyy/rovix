import { EnvError, parseEnv } from './env';

describe('parseEnv', () => {
  it('accepts a relative API path and strips trailing slashes', () => {
    expect(parseEnv({ VITE_API_BASE_URL: '/api/v1/', VITE_APP_NAME: 'Nile Motors' })).toEqual({
      appName: 'Nile Motors',
      apiBaseUrl: '/api/v1',
    });
  });

  it('accepts an absolute API URL', () => {
    expect(parseEnv({ VITE_API_BASE_URL: 'https://api.example.com/api/v1' }).apiBaseUrl).toBe(
      'https://api.example.com/api/v1',
    );
  });

  it('falls back to a default app name', () => {
    expect(parseEnv({ VITE_API_BASE_URL: '/api/v1' }).appName).toBe('CDMS');
  });

  it('rejects a missing API base URL', () => {
    expect(() => parseEnv({})).toThrow(EnvError);
    expect(() => parseEnv({ VITE_API_BASE_URL: '   ' })).toThrow(EnvError);
  });

  it('rejects a value that is neither a path nor a URL', () => {
    expect(() => parseEnv({ VITE_API_BASE_URL: 'api/v1' })).toThrow(EnvError);
  });
});
