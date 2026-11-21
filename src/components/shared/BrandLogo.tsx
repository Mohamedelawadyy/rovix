import logoUrl from '@/assets/brand/logo.png';
import { env } from '@/app/config/env';

/** Intrinsic size of the cropped logo asset, used to reserve space and avoid layout shift. */
const LOGO_WIDTH = 672;
const LOGO_HEIGHT = 158;

interface BrandLogoProps {
  /** Rendered height in pixels; width follows the original aspect ratio. */
  height?: number;
  className?: string;
}

/**
 * Official ABO ALI logo. Never recolor or stretch it: only the height is configurable.
 * The asset has a white background, so place it on light surfaces (or a white tile on dark ones).
 */
export function BrandLogo({ height = 40, className }: BrandLogoProps) {
  return (
    <img
      src={logoUrl}
      alt={env.appName}
      width={Math.round((LOGO_WIDTH / LOGO_HEIGHT) * height)}
      height={height}
      className={className}
      decoding="async"
    />
  );
}
