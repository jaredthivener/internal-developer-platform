import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AzureBlobDesiredStateStore } from '@/lib/persistence/azureBlobStore';
import { type DesiredStateSubmissionRecord } from '@/lib/persistence/types';

const blobClient = {
  upload: vi.fn().mockResolvedValue({}),
  deleteIfExists: vi.fn().mockResolvedValue({}),
  downloadToBuffer: vi.fn(),
};
const containerClient = {
  createIfNotExists: vi.fn().mockResolvedValue({}),
  getBlockBlobClient: vi.fn(() => blobClient),
};

vi.mock('@azure/identity', () => ({ DefaultAzureCredential: vi.fn() }));
vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: vi.fn(function () {
    return { getContainerClient: () => containerClient };
  }),
}));

const record: DesiredStateSubmissionRecord = {
  requestId: 'req-1',
  group: 'storage.azure.upbound.io',
  version: 'v1beta1',
  plural: 'accounts',
  payload: { metadata: { name: 'store01' } },
  status: 'pending',
  workflow: 'crossplane-resource-submission',
  createdAt: '2026-11-03T00:00:00.000Z',
  updatedAt: '2026-11-03T00:00:00.000Z',
};

describe('AzureBlobDesiredStateStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('overwrites the record in one upload, with no delete window', async () => {
    const store = new AzureBlobDesiredStateStore(
      'https://example.blob.core.windows.net',
      'desired-state'
    );

    await store.persistSubmission(record);

    expect(blobClient.deleteIfExists).not.toHaveBeenCalled();
    expect(containerClient.getBlockBlobClient).toHaveBeenCalledWith(
      'desired-state/req-1.json'
    );
    const [body, length] = blobClient.upload.mock.calls[0];
    expect(JSON.parse(body)).toEqual(record);
    expect(length).toBe(Buffer.byteLength(body));
  });
});
