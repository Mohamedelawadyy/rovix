import { render, screen } from '@testing-library/react';
import { env } from '@/app/config/env';
import { BrandLogo } from './BrandLogo';

describe('BrandLogo', () => {
  it('uses the app name as accessible text', () => {
    render(<BrandLogo />);

    expect(screen.getByRole('img', { name: env.appName })).toBeInTheDocument();
  });

  it('keeps the original aspect ratio for any height', () => {
    render(<BrandLogo height={79} />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('height', '79');
    expect(img).toHaveAttribute('width', '336');
  });
});
