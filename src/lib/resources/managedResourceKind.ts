export type ManagedResourceKind = {
  id: string;
  displayName: string;
  emptyStateDescription: string;
  emptyStateActionLabel: string;
  catalogHref: string;
  observationsPathname: string;
  crossplane: {
    group: string;
    version: string;
    plural: string;
  };
};

export const azureStorageAccountResourceKind: ManagedResourceKind = {
  id: 'azure-storage-account',
  displayName: 'Azure Storage Account',
  emptyStateDescription:
    'Storage accounts created from the catalog will appear here first for lifecycle operations while the broader resource surface is still being onboarded.',
  emptyStateActionLabel: 'Open the storage workflow',
  catalogHref: '/catalog/azure-storage',
  observationsPathname: '/api/observations/storage-accounts',
  crossplane: {
    group: 'storage.azure.upbound.io',
    version: 'v1beta1',
    plural: 'accounts',
  },
};
