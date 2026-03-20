import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AzureStorageCatalogPage from '@/app/catalog/azure-storage/page';

vi.mock('@/components/features/catalog/AzureStorageAccountWorkflow', () => ({
  default: () => <div>Create Azure Storage Account</div>,
}));

describe('Azure Storage Catalog Page', () => {
  it('renders the workflow title, summary, and catalog back link', () => {
    render(<AzureStorageCatalogPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Azure Storage Account'
    );
    expect(
      screen.getByText(
        /request a governed azure storage account through the platform catalog/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /back to catalog/i })
    ).toHaveAttribute('href', '/catalog');
    expect(
      screen.getByText('Create Azure Storage Account')
    ).toBeInTheDocument();
  });
});
