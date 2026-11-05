import os from 'node:os';
import path from 'node:path';
import { shouldUseCrossplaneMockMode } from '@/lib/crossplane/offlineMode';
import { AzureBlobDesiredStateStore } from '@/lib/persistence/azureBlobStore';
import { FileSystemDesiredStateStore } from '@/lib/persistence/fileStore';
import { type DesiredStateStore } from '@/lib/persistence/types';

let desiredStateStoreInstance: DesiredStateStore | null = null;

function hasAzureBlobConfiguration(): boolean {
  return Boolean(
    process.env.IDP_DESIRED_STATE_AZURE_BLOB_ACCOUNT_URL &&
    process.env.IDP_DESIRED_STATE_AZURE_BLOB_CONTAINER
  );
}

function createDesiredStateStore(): DesiredStateStore {
  if (hasAzureBlobConfiguration()) {
    return new AzureBlobDesiredStateStore(
      process.env.IDP_DESIRED_STATE_AZURE_BLOB_ACCOUNT_URL as string,
      process.env.IDP_DESIRED_STATE_AZURE_BLOB_CONTAINER as string
    );
  }

  if (process.env.IDP_DESIRED_STATE_FILESYSTEM_PATH) {
    return new FileSystemDesiredStateStore(
      process.env.IDP_DESIRED_STATE_FILESYSTEM_PATH
    );
  }

  // The pod filesystem is lost on restart, which would silently discard the
  // desired-state record this store exists to keep. Fail the request instead.
  if (process.env.NODE_ENV === 'production' && !shouldUseCrossplaneMockMode()) {
    throw new Error(
      'Desired-state persistence is not configured. Set IDP_DESIRED_STATE_AZURE_BLOB_ACCOUNT_URL and IDP_DESIRED_STATE_AZURE_BLOB_CONTAINER, or IDP_DESIRED_STATE_FILESYSTEM_PATH to a persistent volume.'
    );
  }

  return new FileSystemDesiredStateStore(
    path.join(os.tmpdir(), 'idp', 'desired-state-submissions')
  );
}

export function getDesiredStateStore(): DesiredStateStore {
  if (!desiredStateStoreInstance) {
    desiredStateStoreInstance = createDesiredStateStore();
  }

  return desiredStateStoreInstance;
}
