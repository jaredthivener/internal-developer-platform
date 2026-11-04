import { azureStorageAccountResourceKind } from '@/lib/resources/managedResourceKind';

export type ResourceVerb = 'get' | 'list' | 'create' | 'delete' | 'patch';

const storage = azureStorageAccountResourceKind.crossplane;

// The only custom resources the portal may touch, and how. Everything else is
// rejected before a request reaches the Kubernetes API, regardless of what the
// service account's RBAC would allow.
const ALLOWED_RESOURCES: Record<string, readonly ResourceVerb[]> = {
  [`${storage.group}/${storage.version}/${storage.plural}`]: [
    'get',
    'list',
    'create',
    'delete',
    'patch',
  ],
  // Approved resource groups for the storage workflow picker.
  'azure.m.upbound.io/v1beta1/resourcegroups': ['list'],
};

export function isAllowedResource(
  group: string,
  version: string,
  plural: string,
  verb: ResourceVerb
): boolean {
  return (
    ALLOWED_RESOURCES[`${group}/${version}/${plural}`]?.includes(verb) ?? false
  );
}
