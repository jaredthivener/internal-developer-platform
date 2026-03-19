import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResourceProvisioner from '@/components/features/crossplane/ResourceProvisioner';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ResourceProvisioner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the generic form fields for S3 bucket provision', () => {
    render(<ResourceProvisioner />);
    expect(screen.getByText('Provision Application Base')).toBeInTheDocument();
    expect(screen.getByLabelText(/Workspace Region/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /deploy app environment/i })
    ).toBeInTheDocument();
  });

  it('submits the form and handles successful creation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { metadata: { name: 'crossplane-bucket-123' } },
      }),
    } as Response);

    render(<ResourceProvisioner />);

    const submitBtn = screen.getByRole('button', {
      name: /deploy app environment/i,
    });
    fireEvent.click(submitBtn);

    // Should indicate success
    await waitFor(() => {
      expect(
        screen.getByText(/Successfully provisioned: crossplane-bucket-123/i)
      ).toBeInTheDocument();
    });

    // Check payload passed to fetch
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/crossplane/resources',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('displays an error if the API request fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Bad Request' }),
    } as Response);

    render(<ResourceProvisioner />);

    const submitBtn = screen.getByRole('button', {
      name: /deploy app environment/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Bad Request/i)).toBeInTheDocument();
    });
  });
});
