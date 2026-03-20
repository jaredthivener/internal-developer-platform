import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ResourcesPage from '@/app/resources/page';

vi.mock('@/components/features/resources/StorageAccountResourceList', () => ({
  default: () => <div>Storage Account Resource List</div>,
}));

describe('Resources Page', () => {
  it('renders the resources title and inventory summary', () => {
    render(<ResourcesPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Resources'
    );
    expect(
      screen.getByText(
        /review provisioned platform resources, inspect their status, and open deeper operational actions/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('Storage Account Resource List')
    ).toBeInTheDocument();
  });
});
