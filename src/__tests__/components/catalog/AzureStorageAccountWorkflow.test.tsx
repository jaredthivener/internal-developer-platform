import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AzureStorageAccountWorkflow from '@/components/features/catalog/AzureStorageAccountWorkflow';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AzureStorageAccountWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the storage workflow with approved resource-group selection', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            metadata: { name: 'idp-crossplane-smoke' },
            status: {
              conditions: [{ type: 'Ready', status: 'True' }],
            },
          },
        ],
      }),
    } as Response);

    render(<AzureStorageAccountWorkflow />);

    expect(
      screen.getByRole('heading', { name: /create azure storage account/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/storage account name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/resource group/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create storage account/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/platform-managed/i)).toBeInTheDocument();
    expect(screen.getByText(/security defaults applied/i)).toBeInTheDocument();
    expect(
      screen.getByText(/technical implementation details/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/apiversion/i)).toBeInTheDocument();
    expect(
      screen.getByText('storage.azure.upbound.io/v1beta1')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /advanced configuration/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/simple defaults/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /existing storage accounts/i })
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText(
        /only approved resource groups surfaced by the platform can be targeted/i
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/^Kind$/)).toBeInTheDocument();
    expect(screen.getByText(/^Account$/)).toBeInTheDocument();
  });

  it('submits a storage account request and shows a success message', async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            metadata: { name: 'idp-crossplane-smoke' },
            status: {
              conditions: [{ type: 'Ready', status: 'True' }],
            },
          },
        ],
      }),
    } as Response);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { metadata: { name: 'devstorealpha01' } },
      }),
    } as Response);

    render(<AzureStorageAccountWorkflow />);

    await user.clear(screen.getByLabelText(/storage account name/i));
    await user.type(
      screen.getByLabelText(/storage account name/i),
      'devstorealpha01'
    );
    await screen.findByText(
      /only approved resource groups surfaced by the platform can be targeted/i
    );
    await user.click(
      screen.getByRole('button', { name: /create storage account/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /successfully submitted storage account: devstorealpha01/i
        )
      ).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/crossplane/resources',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const requestBody = JSON.parse(
      (mockFetch.mock.calls[1]?.[1] as { body: string }).body
    );

    expect(requestBody.group).toBe('storage.azure.upbound.io');
    expect(requestBody.version).toBe('v1beta1');
    expect(requestBody.plural).toBe('accounts');
    expect(requestBody.payload.metadata.name).toBe('devstorealpha01');
    expect(requestBody.payload.spec.providerConfigRef).toEqual({
      name: 'default',
    });
    expect(requestBody.payload.spec.forProvider).toEqual(
      expect.objectContaining({
        resourceGroupName: 'idp-crossplane-smoke',
        location: 'westus3',
        accountTier: 'Standard',
        accountKind: 'StorageV2',
        accountReplicationType: 'LRS',
        accessTier: 'Hot',
        minTlsVersion: 'TLS1_2',
        httpsTrafficOnlyEnabled: true,
        publicNetworkAccessEnabled: true,
        sharedAccessKeyEnabled: true,
        allowNestedItemsToBePublic: false,
        crossTenantReplicationEnabled: true,
        infrastructureEncryptionEnabled: true,
        defaultToOauthAuthentication: false,
        isHnsEnabled: false,
        largeFileShareEnabled: false,
        localUserEnabled: true,
        nfsv3Enabled: false,
        sftpEnabled: false,
      })
    );
  });

  it('lets advanced users customize additional storage account settings', async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            metadata: { name: 'idp-crossplane-smoke' },
            status: {
              conditions: [{ type: 'Ready', status: 'True' }],
            },
          },
        ],
      }),
    } as Response);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { metadata: { name: 'advancedstore01' } },
      }),
    } as Response);

    render(<AzureStorageAccountWorkflow />);

    await screen.findByText(
      /only approved resource groups surfaced by the platform can be targeted/i
    );

    await user.clear(screen.getByLabelText(/storage account name/i));
    await user.type(
      screen.getByLabelText(/storage account name/i),
      'advancedstore01'
    );
    await user.click(
      screen.getByRole('button', { name: /advanced configuration/i })
    );

    await user.click(screen.getByLabelText(/hierarchical namespace/i));
    await user.click(
      screen.getByLabelText(/default to microsoft entra authorization/i)
    );
    await user.click(screen.getByLabelText(/disable shared key access/i));
    await user.click(screen.getByLabelText(/disable local users/i));
    await user.click(screen.getByLabelText(/enable sftp/i));
    await user.click(screen.getByLabelText(/enable large file shares/i));

    await user.click(screen.getByLabelText(/minimum tls version/i));
    await user.click(screen.getByRole('option', { name: 'TLS1_1' }));

    await user.click(screen.getByLabelText(/allowed copy scope/i));
    await user.click(screen.getByRole('option', { name: /private link/i }));

    await user.click(
      screen.getByRole('button', { name: /create storage account/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /successfully submitted storage account: advancedstore01/i
        )
      ).toBeInTheDocument();
    });

    const requestBody = JSON.parse(
      (mockFetch.mock.calls[1]?.[1] as { body: string }).body
    );

    expect(requestBody.payload.spec.forProvider).toEqual(
      expect.objectContaining({
        isHnsEnabled: true,
        defaultToOauthAuthentication: true,
        sharedAccessKeyEnabled: false,
        localUserEnabled: true,
        sftpEnabled: true,
        largeFileShareEnabled: true,
        minTlsVersion: 'TLS1_1',
        allowedCopyScope: 'PrivateLink',
      })
    );
  });

  it('enforces premium tier for premium-only account kinds', async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            metadata: { name: 'idp-crossplane-smoke' },
            status: {
              conditions: [{ type: 'Ready', status: 'True' }],
            },
          },
        ],
      }),
    } as Response);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { metadata: { name: 'premiumblob01' } },
      }),
    } as Response);

    render(<AzureStorageAccountWorkflow />);

    await screen.findByText(
      /only approved resource groups surfaced by the platform can be targeted/i
    );
    await user.clear(screen.getByLabelText(/storage account name/i));
    await user.type(
      screen.getByLabelText(/storage account name/i),
      'premiumblob01'
    );

    await user.click(screen.getByLabelText(/account kind/i));
    await user.click(screen.getByRole('option', { name: 'BlockBlobStorage' }));

    expect(
      screen.getByText(
        /premium is required for blockblobstorage and filestorage accounts/i
      )
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /create storage account/i })
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/crossplane/resources',
        expect.objectContaining({ method: 'POST' })
      );
    });

    const requestBody = JSON.parse(
      (mockFetch.mock.calls[1]?.[1] as { body: string }).body
    );

    expect(requestBody.payload.spec.forProvider).toEqual(
      expect.objectContaining({
        accountKind: 'BlockBlobStorage',
        accountTier: 'Premium',
      })
    );
  });

  it('removes access tier from the payload when the selected account kind does not support it', async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            metadata: { name: 'idp-crossplane-smoke' },
            status: {
              conditions: [{ type: 'Ready', status: 'True' }],
            },
          },
        ],
      }),
    } as Response);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { metadata: { name: 'classicstorage01' } },
      }),
    } as Response);

    render(<AzureStorageAccountWorkflow />);

    await screen.findByText(
      /only approved resource groups surfaced by the platform can be targeted/i
    );
    await user.clear(screen.getByLabelText(/storage account name/i));
    await user.type(
      screen.getByLabelText(/storage account name/i),
      'classicstorage01'
    );

    await user.click(screen.getByLabelText(/account kind/i));
    await user.click(screen.getByRole('option', { name: 'Storage' }));

    expect(
      screen.getByText(
        /access tier only applies to blobstorage, filestorage, and storagev2 accounts/i
      )
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /create storage account/i })
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/crossplane/resources',
        expect.objectContaining({ method: 'POST' })
      );
    });

    const requestBody = JSON.parse(
      (mockFetch.mock.calls[1]?.[1] as { body: string }).body
    );

    expect(requestBody.payload.spec.forProvider.accountKind).toBe('Storage');
    expect(requestBody.payload.spec.forProvider).not.toHaveProperty(
      'accessTier'
    );
  });

  it('blocks submission when no approved resource groups are ready', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            metadata: { name: 'pending-rg' },
            status: {
              conditions: [{ type: 'Ready', status: 'False' }],
            },
          },
        ],
      }),
    } as Response);

    render(<AzureStorageAccountWorkflow />);

    expect(
      await screen.findByText(
        /no approved resource groups are currently ready for storage provisioning/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create storage account/i })
    ).toBeDisabled();
  });

  it('surfaces an API error when the storage request fails', async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            metadata: { name: 'idp-crossplane-smoke' },
            status: {
              conditions: [{ type: 'Ready', status: 'True' }],
            },
          },
        ],
      }),
    } as Response);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Storage quota policy denied request' }),
    } as Response);

    render(<AzureStorageAccountWorkflow />);

    await screen.findByText(
      /only approved resource groups surfaced by the platform can be targeted/i
    );

    await user.click(
      screen.getByRole('button', { name: /create storage account/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/storage quota policy denied request/i)
      ).toBeInTheDocument();
    });
  });
});
