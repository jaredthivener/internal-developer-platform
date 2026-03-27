import 'server-only';

import { DefaultAzureCredential } from '@azure/identity';
import { getCustomObjectsApi } from '@/lib/crossplane/client';
import { shouldUseCrossplaneMockMode } from '@/lib/crossplane/offlineMode';
import { REQUEST_ID_ANNOTATION } from '@/lib/persistence/types';
import { formatObservationClassification as formatObservationClassificationLabel } from '@/lib/observations/presentation';
import {
  type ObservationClassCode,
  type ObservationSeverity,
  type StorageAccountObservationClassification,
  type StorageAccountObservationDetail,
  type StorageAccountObservationDiff,
  type StorageAccountObservationsResponse,
  type StorageAccountObservationShape,
  type StorageAccountObservationSummary,
} from '@/lib/observations/types';

type ObservationOptions = {
  forceRefresh?: boolean;
};

type CrossplaneCondition = {
  type?: string;
  status?: string;
};

type CrossplaneStorageAccount = {
  metadata?: {
    name?: string;
    uid?: string;
    annotations?: Record<string, string>;
    deletionTimestamp?: string;
  };
  spec?: {
    forProvider?: {
      resourceGroupName?: string;
      location?: string;
      accountTier?: string;
      accountReplicationType?: string;
      accessTier?: string;
      publicNetworkAccessEnabled?: boolean;
    };
  };
  status?: {
    atProvider?: {
      id?: string;
      primaryLocation?: string;
      accessTier?: string;
      skuName?: string;
      publicNetworkAccessEnabled?: boolean;
    };
    conditions?: CrossplaneCondition[];
  };
};

type AzureStorageAccountLiveState = {
  id?: string;
  resourceGroupName?: string;
  location?: string;
  accountTier?: string;
  replicationType?: string;
  accessTier?: string;
  publicNetworkAccessEnabled?: boolean;
};

type AzureObservationResult =
  | {
      status: 'found';
      live: AzureStorageAccountLiveState;
    }
  | {
      status: 'missing';
    }
  | {
      status: 'unavailable';
    };

const CACHE_TTL_SECONDS = 300;
const STORAGE_ARM_API_VERSION = '2024-01-01';

let cachedObservations: {
  expiresAt: number;
  response: StorageAccountObservationsResponse<
    StorageAccountObservationSummary[]
  >;
} | null = null;

function isConditionTrue(
  conditions: CrossplaneCondition[] | undefined,
  type: string
): boolean {
  return (
    conditions?.some(
      (condition) => condition.type === type && condition.status === 'True'
    ) || false
  );
}

function toSeverity(code: ObservationClassCode): ObservationSeverity {
  switch (code) {
    case 'in_sync':
      return 'success';
    case 'provisioning':
      return 'info';
    case 'deleting':
    case 'config_drift':
    case 'ownership_drift':
    case 'identity_drift':
      return 'warning';
    case 'missing_in_azure':
    case 'orphaned_in_azure':
    case 'scan_error':
      return 'critical';
  }
}

function normalizeDesired(
  resource: CrossplaneStorageAccount
): StorageAccountObservationShape {
  return {
    resourceGroupName: resource.spec?.forProvider?.resourceGroupName,
    location: resource.spec?.forProvider?.location,
    accountTier: resource.spec?.forProvider?.accountTier,
    replicationType: resource.spec?.forProvider?.accountReplicationType,
    accessTier: resource.spec?.forProvider?.accessTier,
    publicNetworkAccessEnabled:
      resource.spec?.forProvider?.publicNetworkAccessEnabled,
  };
}

function normalizeLive(
  resource: CrossplaneStorageAccount,
  live?: AzureStorageAccountLiveState
): StorageAccountObservationShape {
  if (live) {
    return {
      resourceGroupName: live.resourceGroupName,
      location: live.location,
      accountTier: live.accountTier,
      replicationType: live.replicationType,
      accessTier: live.accessTier,
      publicNetworkAccessEnabled: live.publicNetworkAccessEnabled,
    };
  }

  const skuName = resource.status?.atProvider?.skuName;
  const fallbackTier = skuName?.split('_')[0];
  const fallbackReplication = skuName?.split('_')[1];

  return {
    resourceGroupName: resource.spec?.forProvider?.resourceGroupName,
    location:
      resource.status?.atProvider?.primaryLocation ||
      resource.spec?.forProvider?.location,
    accountTier: fallbackTier || resource.spec?.forProvider?.accountTier,
    replicationType:
      fallbackReplication || resource.spec?.forProvider?.accountReplicationType,
    accessTier:
      resource.status?.atProvider?.accessTier ||
      resource.spec?.forProvider?.accessTier,
    publicNetworkAccessEnabled:
      resource.status?.atProvider?.publicNetworkAccessEnabled ??
      resource.spec?.forProvider?.publicNetworkAccessEnabled,
  };
}

function buildDiffs(
  desired: StorageAccountObservationShape,
  live: StorageAccountObservationShape
): StorageAccountObservationDiff[] {
  const fields: Array<{
    field: keyof StorageAccountObservationShape;
    category: StorageAccountObservationDiff['category'];
  }> = [
    { field: 'resourceGroupName', category: 'identity' },
    { field: 'location', category: 'identity' },
    { field: 'accountTier', category: 'sku' },
    { field: 'replicationType', category: 'sku' },
    { field: 'accessTier', category: 'data' },
    { field: 'publicNetworkAccessEnabled', category: 'network' },
  ];

  return fields.flatMap(({ field, category }) => {
    const desiredValue = desired[field] ?? null;
    const liveValue = live[field] ?? null;

    if (desiredValue === liveValue) {
      return [];
    }

    return [
      {
        field,
        desired: desiredValue,
        live: liveValue,
        category,
      },
    ];
  });
}

function buildClassification(
  resource: CrossplaneStorageAccount,
  observationResult: AzureObservationResult,
  diffs: StorageAccountObservationDiff[]
): StorageAccountObservationClassification {
  const conditions = resource.status?.conditions;
  const ready = isConditionTrue(conditions, 'Ready');
  const synced = isConditionTrue(conditions, 'Synced');

  let code: ObservationClassCode = 'in_sync';
  let reasonCodes: string[] = [];

  if (resource.metadata?.deletionTimestamp) {
    code = 'deleting';
    reasonCodes = ['deleting'];
  } else if (!resource.status?.atProvider?.id || !ready || !synced) {
    code = 'provisioning';
    reasonCodes = [!resource.status?.atProvider?.id ? 'externalName' : 'ready'];
  } else if (observationResult.status === 'unavailable') {
    reasonCodes = ['azureObservationUnavailable'];
  } else if (
    resource.status?.atProvider?.id &&
    observationResult.status === 'missing'
  ) {
    code = 'missing_in_azure';
    reasonCodes = ['azureResourceMissing'];
  } else if (diffs.length > 0) {
    code = 'config_drift';
    reasonCodes = diffs.map((diff) => diff.field);
  }

  return {
    code,
    severity: toSeverity(code),
    reasonCodes,
    diffCount: diffs.length,
  };
}

function toNormalizedRecord(
  shape: StorageAccountObservationShape
): Record<string, string | boolean | null> {
  return {
    resourceGroupName: shape.resourceGroupName ?? null,
    location: shape.location ?? null,
    accountTier: shape.accountTier ?? null,
    replicationType: shape.replicationType ?? null,
    accessTier: shape.accessTier ?? null,
    publicNetworkAccessEnabled: shape.publicNetworkAccessEnabled ?? null,
  };
}

function parseAzureStorageAccountLiveState(
  payload: Record<string, unknown>
): AzureStorageAccountLiveState {
  const sku =
    typeof payload.sku === 'object' && payload.sku !== null
      ? (payload.sku as { name?: string })
      : undefined;
  const properties =
    typeof payload.properties === 'object' && payload.properties !== null
      ? (payload.properties as Record<string, unknown>)
      : {};
  const skuName = sku?.name;

  return {
    id: typeof payload.id === 'string' ? payload.id : undefined,
    resourceGroupName:
      typeof payload.id === 'string' ? payload.id.split('/')[4] : undefined,
    location:
      typeof payload.location === 'string' ? payload.location : undefined,
    accountTier: skuName?.split('_')[0],
    replicationType: skuName?.split('_')[1],
    accessTier:
      typeof properties.accessTier === 'string'
        ? (properties.accessTier as string)
        : undefined,
    publicNetworkAccessEnabled:
      typeof properties.publicNetworkAccess === 'string'
        ? properties.publicNetworkAccess === 'Enabled'
        : undefined,
  };
}

async function getAzureManagementToken(): Promise<string | null> {
  if (!process.env.AZURE_CLIENT_ID && !process.env.AZURE_TENANT_ID) {
    return null;
  }

  const credential = new DefaultAzureCredential();
  const token = await credential.getToken(
    'https://management.azure.com/.default'
  );

  return token?.token || null;
}

async function fetchAzureStorageAccount(
  armId: string | undefined
): Promise<AzureObservationResult> {
  if (!armId) {
    return { status: 'unavailable' };
  }

  const token = await getAzureManagementToken();

  if (!token) {
    return { status: 'unavailable' };
  }

  const response = await fetch(
    `https://management.azure.com${armId}?api-version=${STORAGE_ARM_API_VERSION}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    }
  );

  if (response.status === 404) {
    return { status: 'missing' };
  }

  if (!response.ok) {
    throw new Error(`Azure observation failed with status ${response.status}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;

  return {
    status: 'found',
    live: parseAzureStorageAccountLiveState(payload),
  };
}

function buildMockObservationResponse(): StorageAccountObservationsResponse<
  StorageAccountObservationSummary[]
> {
  const observedAt = new Date().toISOString();

  return {
    scan: {
      source: 'crossplane+azure',
      observedAt,
      cacheTtlSeconds: CACHE_TTL_SECONDS,
    },
    data: [
      {
        resourceName: 'devstorealpha01',
        resourceKey:
          '/subscriptions/test/resourcegroups/idp-crossplane-smoke/providers/microsoft.storage/storageaccounts/devstorealpha01',
        azureResourceId:
          '/subscriptions/test/resourceGroups/idp-crossplane-smoke/providers/Microsoft.Storage/storageAccounts/devstorealpha01',
        classification: {
          code: 'in_sync',
          severity: 'success',
          reasonCodes: [],
          diffCount: 0,
        },
        ownership: {
          requestId: 'mock-request-id',
          managedBy: 'idp',
        },
        desired: {
          resourceGroupName: 'idp-crossplane-smoke',
          location: 'westus3',
          accountTier: 'Standard',
          replicationType: 'LRS',
          accessTier: 'Hot',
          publicNetworkAccessEnabled: true,
        },
        live: {
          resourceGroupName: 'idp-crossplane-smoke',
          location: 'westus3',
          accountTier: 'Standard',
          replicationType: 'LRS',
          accessTier: 'Hot',
          publicNetworkAccessEnabled: true,
        },
        observedAt,
      },
    ],
  };
}

async function loadCrossplaneStorageAccounts(): Promise<
  CrossplaneStorageAccount[]
> {
  const k8sClient =
    getCustomObjectsApi() as /* eslint-disable-line @typescript-eslint/no-explicit-any */ any;
  const response = await k8sClient.listClusterCustomObject({
    group: 'storage.azure.upbound.io',
    version: 'v1beta1',
    plural: 'accounts',
  });

  const body =
    response && typeof response === 'object' && 'body' in response
      ? (response.body as { items?: CrossplaneStorageAccount[] })
      : (response as { items?: CrossplaneStorageAccount[] });

  return Array.isArray(body?.items) ? body.items : [];
}

async function buildObservationDetail(
  resource: CrossplaneStorageAccount,
  observedAt: string
): Promise<StorageAccountObservationDetail> {
  const desired = normalizeDesired(resource);
  const observationResult = await fetchAzureStorageAccount(
    resource.status?.atProvider?.id
  );
  const liveState =
    observationResult.status === 'found' ? observationResult.live : undefined;
  const live = normalizeLive(resource, liveState);
  const diffs = buildDiffs(desired, live);
  const classification = buildClassification(
    resource,
    observationResult,
    diffs
  );
  const resourceName = resource.metadata?.name || 'unknown-resource';
  const azureResourceId = liveState?.id || resource.status?.atProvider?.id;

  return {
    resourceName,
    resourceKey:
      azureResourceId?.toLowerCase() ||
      `${desired.resourceGroupName || 'unknown'}|${resourceName}`.toLowerCase(),
    azureResourceId,
    classification,
    ownership: {
      requestId: resource.metadata?.annotations?.[REQUEST_ID_ANNOTATION],
      managedBy: 'idp',
    },
    desired,
    live,
    observedAt,
    crossplane: {
      name: resourceName,
      uid: resource.metadata?.uid,
      ready: isConditionTrue(resource.status?.conditions, 'Ready'),
      synced: isConditionTrue(resource.status?.conditions, 'Synced'),
      deletionTimestamp: resource.metadata?.deletionTimestamp || null,
    },
    normalizedDesired: toNormalizedRecord(desired),
    normalizedLive: toNormalizedRecord(live),
    diffs,
  };
}

export async function getStorageAccountObservations(
  options: ObservationOptions = {}
): Promise<
  StorageAccountObservationsResponse<StorageAccountObservationSummary[]>
> {
  if (
    !options.forceRefresh &&
    cachedObservations &&
    Date.now() < cachedObservations.expiresAt
  ) {
    return cachedObservations.response;
  }

  if (shouldUseCrossplaneMockMode()) {
    const response = buildMockObservationResponse();
    cachedObservations = {
      response,
      expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
    };
    return response;
  }

  const observedAt = new Date().toISOString();
  const resources = await loadCrossplaneStorageAccounts();
  const details = await Promise.all(
    resources.map((resource) => buildObservationDetail(resource, observedAt))
  );

  const response: StorageAccountObservationsResponse<
    StorageAccountObservationSummary[]
  > = {
    scan: {
      source: 'crossplane+azure',
      observedAt,
      cacheTtlSeconds: CACHE_TTL_SECONDS,
    },
    data: details.map(
      ({
        resourceName,
        resourceKey,
        azureResourceId,
        classification,
        ownership,
        desired,
        live,
        observedAt: detailObservedAt,
      }) => ({
        resourceName,
        resourceKey,
        azureResourceId,
        classification,
        ownership,
        desired,
        live,
        observedAt: detailObservedAt,
      })
    ),
  };

  cachedObservations = {
    response,
    expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
  };

  return response;
}

export async function getStorageAccountObservationByName(
  resourceName: string,
  options: ObservationOptions = {}
): Promise<StorageAccountObservationsResponse<StorageAccountObservationDetail> | null> {
  if (options.forceRefresh) {
    cachedObservations = null;
  }

  if (shouldUseCrossplaneMockMode()) {
    const response = buildMockObservationResponse();
    const match = response.data.find(
      (item) => item.resourceName === resourceName
    );

    if (!match) {
      return null;
    }

    return {
      scan: response.scan,
      data: {
        ...match,
        crossplane: {
          name: match.resourceName,
          ready: true,
          synced: true,
          deletionTimestamp: null,
        },
        normalizedDesired: toNormalizedRecord(match.desired),
        normalizedLive: toNormalizedRecord(match.live),
        diffs: [],
      },
    };
  }

  const observedAt = new Date().toISOString();
  const resources = await loadCrossplaneStorageAccounts();
  const match = resources.find(
    (resource) => resource.metadata?.name === resourceName
  );

  if (!match) {
    return null;
  }

  const detail = await buildObservationDetail(match, observedAt);

  return {
    scan: {
      source: 'crossplane+azure',
      observedAt,
      cacheTtlSeconds: CACHE_TTL_SECONDS,
    },
    data: detail,
  };
}

export function formatObservationClassification(
  code: ObservationClassCode
): string {
  return formatObservationClassificationLabel(code);
}
