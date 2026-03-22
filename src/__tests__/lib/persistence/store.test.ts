import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('getDesiredStateStore', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the configured filesystem path when provided', async () => {
    vi.stubEnv('IDP_DESIRED_STATE_AZURE_BLOB_ACCOUNT_URL', '');
    vi.stubEnv('IDP_DESIRED_STATE_AZURE_BLOB_CONTAINER', '');
    vi.stubEnv(
      'IDP_DESIRED_STATE_FILESYSTEM_PATH',
      '/var/run/idp/desired-state'
    );

    const fileSystemStoreCtor = vi.fn(function (
      this: object,
      rootDirectory: string
    ) {
      Object.assign(this, { rootDirectory });
    });

    vi.doMock('@/lib/persistence/fileStore', () => ({
      FileSystemDesiredStateStore: fileSystemStoreCtor,
    }));
    vi.doMock('@/lib/persistence/azureBlobStore', () => ({
      AzureBlobDesiredStateStore: vi.fn(),
    }));

    const { getDesiredStateStore } = await import('@/lib/persistence/store');
    const store = getDesiredStateStore() as unknown as {
      rootDirectory: string;
    };

    expect(fileSystemStoreCtor).toHaveBeenCalledWith(
      '/var/run/idp/desired-state'
    );
    expect(store.rootDirectory).toBe('/var/run/idp/desired-state');
  });

  it('falls back to a temp directory when no persistence configuration is set', async () => {
    vi.stubEnv('IDP_DESIRED_STATE_AZURE_BLOB_ACCOUNT_URL', '');
    vi.stubEnv('IDP_DESIRED_STATE_AZURE_BLOB_CONTAINER', '');
    vi.stubEnv('IDP_DESIRED_STATE_FILESYSTEM_PATH', '');

    const fileSystemStoreCtor = vi.fn(function (
      this: object,
      rootDirectory: string
    ) {
      Object.assign(this, { rootDirectory });
    });

    vi.doMock('@/lib/persistence/fileStore', () => ({
      FileSystemDesiredStateStore: fileSystemStoreCtor,
    }));
    vi.doMock('@/lib/persistence/azureBlobStore', () => ({
      AzureBlobDesiredStateStore: vi.fn(),
    }));

    const { getDesiredStateStore } = await import('@/lib/persistence/store');
    const store = getDesiredStateStore() as unknown as {
      rootDirectory: string;
    };

    const expectedPath = path.join(
      os.tmpdir(),
      'idp',
      'desired-state-submissions'
    );

    expect(fileSystemStoreCtor).toHaveBeenCalledWith(expectedPath);
    expect(store.rootDirectory).toBe(expectedPath);
  });
});
