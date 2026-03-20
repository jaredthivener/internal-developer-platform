import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CompositionList from '@/components/features/crossplane/CompositionList';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CompositionList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    // Setup a pending promise
    mockFetch.mockImplementationOnce(() => new Promise(() => {}));

    render(<CompositionList />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders an error message on API failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    } as Response);

    render(<CompositionList />);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to load compositions/i)
      ).toBeInTheDocument();
    });
  });

  it('renders a stringified error when the fetch rejection is not an Error', async () => {
    mockFetch.mockRejectedValueOnce('Network offline');

    render(<CompositionList />);

    await waitFor(() => {
      expect(screen.getByText('Network offline')).toBeInTheDocument();
    });
  });

  it('renders a table of compositions on success', async () => {
    const mockData = {
      data: [
        {
          metadata: { name: 'cluster-aws' },
          spec: { compositeTypeRef: { kind: 'XCluster' } },
        },
        {
          metadata: { name: 'database-postgres' },
          spec: { compositeTypeRef: { kind: 'XPostgreSQLInstance' } },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response);

    render(<CompositionList />);

    await waitFor(() => {
      expect(screen.getByText('cluster-aws')).toBeInTheDocument();
      expect(screen.getByText('XCluster')).toBeInTheDocument();
      expect(screen.getByText('database-postgres')).toBeInTheDocument();
      expect(screen.getByText('XPostgreSQLInstance')).toBeInTheDocument();
    });
  });
});
