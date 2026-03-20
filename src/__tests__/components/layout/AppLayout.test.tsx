import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppLayout from '@/components/layout/AppLayout';

const mockUsePathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock('@/app/Providers', () => ({
  ThemeModeContext: {
    Provider: ({ children }: { children: React.ReactNode }) => children,
    _currentValue: {
      toggleColorMode: vi.fn(),
      mode: 'dark',
    },
  },
}));

describe('AppLayout', () => {
  it('renders the left navigation with the resources item', () => {
    mockUsePathname.mockReturnValue('/catalog');

    render(
      <AppLayout>
        <div>Page Content</div>
      </AppLayout>
    );

    expect(screen.getAllByText('IDP Console')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute(
      'href',
      '/'
    );
    expect(screen.getByRole('link', { name: /catalog/i })).toHaveAttribute(
      'href',
      '/catalog'
    );
    expect(screen.getByRole('link', { name: /applications/i })).toHaveAttribute(
      'href',
      '/applications'
    );
    expect(screen.getByRole('link', { name: /resources/i })).toHaveAttribute(
      'href',
      '/resources'
    );
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute(
      'href',
      '/settings'
    );
  });

  it('marks catalog as the active navigation item for catalog routes', () => {
    mockUsePathname.mockReturnValue('/catalog/azure-storage');

    render(
      <AppLayout>
        <div>Page Content</div>
      </AppLayout>
    );

    expect(screen.getByRole('link', { name: /catalog/i })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(
      screen.getByRole('link', { name: /dashboard/i })
    ).not.toHaveAttribute('aria-current', 'page');
  });

  it('marks settings as the active navigation item for settings routes', () => {
    mockUsePathname.mockReturnValue('/settings');

    render(
      <AppLayout>
        <div>Page Content</div>
      </AppLayout>
    );

    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: /catalog/i })).not.toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('marks resources as the active navigation item for resource routes', () => {
    mockUsePathname.mockReturnValue('/resources/devstorealpha01');

    render(
      <AppLayout>
        <div>Page Content</div>
      </AppLayout>
    );

    expect(screen.getByRole('link', { name: /resources/i })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: /catalog/i })).not.toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
