import { ar } from '@/locales/ar';

const t = ar.vehicles.images;

/** Same limits as the backend VehicleImageRequest. */
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateImage(file: File): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return t.invalidType;
  if (file.size > MAX_IMAGE_BYTES) return t.tooLarge;
  return null;
}
