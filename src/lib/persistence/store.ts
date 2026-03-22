import os from 'node:os';
import path from 'node:path';
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

  const rootDirectory =
    process.env.IDP_DESIRED_STATE_FILESYSTEM_PATH ||
    path.join(os.tmpdir(), 'idp', 'desired-state-submissions');

  return new FileSystemDesiredStateStore(rootDirectory);
}

export function getDesiredStateStore(): DesiredStateStore {
  if (!desiredStateStoreInstance) {
    desiredStateStoreInstance = createDesiredStateStore();
  }

  return desiredStateStoreInstance;
}
