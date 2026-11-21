/**
 * Triggers a browser download for a Blob (e.g. from `api.download`).
 * Authenticated files cannot use a plain <a href>, because the request needs the Bearer header.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke after the click has been processed so the download can start.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
