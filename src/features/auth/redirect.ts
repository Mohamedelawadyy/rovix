/**
 * Only same-app paths are allowed as post-login redirects (prevents open redirects such as
 * `?redirect=//evil.com` or `?redirect=https://evil.com`).
 */
export function safeRedirectPath(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  return value;
}
