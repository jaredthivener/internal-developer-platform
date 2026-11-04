import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CloudEstateOverview from '@/components/features/catalog/CloudEstateOverview';
import { livePortfolio, unavailablePortfolio } from '@/test/portfolioFixture';

describe('CloudEstateOverview', () => {
  it('renders the cloud estate summary heading', () => {
    render(<CloudEstateOverview portfolio={livePortfolio} />);

    expect(
      screen.getByRole('heading', { name: /cloud estate overview/i })
    ).toBeInTheDocument();
  });

  it('renders live estate metrics', () => {
    render(<CloudEstateOverview portfolio={livePortfolio} />);

    expect(screen.getByText('Catalog domains')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Live workflows')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Tracked resources')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('MCSB compliance')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('shows a dash rather than a figure when Azure cannot be read', () => {
    render(<CloudEstateOverview portfolio={unavailablePortfolio} />);

    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getByText(/inventory is unavailable/i)).toBeInTheDocument();
    expect(
      screen.getByText(/compliance data is unavailable/i)
    ).toBeInTheDocument();
  });
});
