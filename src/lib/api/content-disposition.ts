/**
 * Reads the filename from a Content-Disposition header.
 * Prefers RFC 5987 `filename*=UTF-8''...` (used by Laravel for non-ASCII names, e.g. Arabic)
 * over the plain `filename="..."`.
 */
export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;

  const extended = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(header);
  if (extended?.[2]) {
    try {
      return decodeURIComponent(extended[2].trim().replace(/^"|"$/g, ''));
    } catch {
      // Malformed encoding: fall back to the plain filename below.
    }
  }

  const plain = /filename\s*=\s*("([^"]*)"|[^;]+)/i.exec(header);
  const value = plain?.[2] ?? plain?.[1];
  return value ? value.trim() : null;
}
