import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ResourceDetailsPage from '@/app/resources/[name]/page';

vi.mock(
  '@/components/features/resources/StorageAccountResourceDetails',
  () => ({
    default: ({ resourceName }: { resourceName: string }) => (
      <div>Storage Account Resource Details: {resourceName}</div>
    ),
  })
);

describe('Resource Details Page', () => {
  it('renders the resource details page title and detail component', async () => {
    const page = await ResourceDetailsPage({
      params: Promise.resolve({ name: 'devstorealpha01' }),
    });

    render(page);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Resource Details'
    );
    expect(
      screen.getByRole('link', { name: /back to resources/i })
    ).toHaveAttribute('href', '/resources');
    expect(
      screen.getByText(/Storage Account Resource Details: devstorealpha01/i)
    ).toBeInTheDocument();
  });
});
