import { render, screen } from '@testing-library/react';
import { App } from './App';
import { env } from './config/env';

describe('App', () => {
  it('renders the application name as the main heading', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: env.appName })).toBeInTheDocument();
  });
});
