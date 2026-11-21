export interface AppEnv {
  /** Display name of the application. */
  appName: string;
  /** Base URL of the Laravel API, without a trailing slash (e.g. `/api/v1`). */
  apiBaseUrl: string;
}

export class EnvError extends Error {
  override name = 'EnvError';
}

type RawEnv = Partial<Record<'VITE_APP_NAME' | 'VITE_API_BASE_URL', string | undefined>>;

/**
 * Validates the build-time environment. Fails fast at startup instead of
 * surfacing as broken requests later.
 */
export function parseEnv(raw: RawEnv): AppEnv {
  const apiBaseUrl = raw.VITE_API_BASE_URL?.trim();

  if (!apiBaseUrl) {
    throw new EnvError('VITE_API_BASE_URL is required (see .env.example).');
  }

  const isRelative = apiBaseUrl.startsWith('/');
  if (!isRelative && !URL.canParse(apiBaseUrl)) {
    throw new EnvError(
      `VITE_API_BASE_URL must be a relative path or an absolute URL, got "${apiBaseUrl}".`,
    );
  }

  return {
    appName: raw.VITE_APP_NAME?.trim() || 'CDMS',
    apiBaseUrl: apiBaseUrl.replace(/\/+$/, ''),
  };
}

export const env: AppEnv = parseEnv(import.meta.env);
