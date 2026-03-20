import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CloudEstateOverview from '@/components/features/catalog/CloudEstateOverview';

describe('CloudEstateOverview', () => {
  it('renders the cloud estate summary heading and description', () => {
    render(<CloudEstateOverview />);

    expect(
      screen.getByRole('heading', { name: /cloud estate overview/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/platform-managed azure footprint/i)
    ).toBeInTheDocument();
  });

  it('renders the top-line estate metrics', () => {
    render(<CloudEstateOverview />);

    expect(screen.getByText('Monthly spend')).toBeInTheDocument();
    expect(screen.getByText('$142')).toBeInTheDocument();
    expect(screen.getByText('Policy coverage')).toBeInTheDocument();
    expect(screen.getByText('89%')).toBeInTheDocument();
    expect(screen.getByText('Critical findings')).toBeInTheDocument();
    expect(screen.getByText('3 open')).toBeInTheDocument();
    expect(screen.getByText('Healthy services')).toBeInTheDocument();
    expect(screen.getByText('12 / 14')).toBeInTheDocument();
  });
});
