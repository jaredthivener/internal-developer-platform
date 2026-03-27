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

    expect(screen.getByText('Catalog domains')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Live workflows')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Tracked services')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('Healthy domains')).toBeInTheDocument();
    expect(screen.getByText('3 / 4')).toBeInTheDocument();
  });
});
