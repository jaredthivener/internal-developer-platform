import 'server-only';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import {
  ARM_ENDPOINT,
  armRequest,
  getAzureManagementToken,
} from '@/lib/azure/arm';
import { serviceCatalogEntries } from '@/lib/catalog/servicePortfolio';
import { shouldUseCrossplaneMockMode } from '@/lib/crossplane/offlineMode';

// Must match COMPLIANCE_ASSIGNMENT_NAME in scripts/azure/bootstrap-aks-control-plane.sh.
export const COMPLIANCE_ASSIGNMENT_NAME = 'idp-mcsb-v2';
export const COMPLIANCE_FRAMEWORK = 'Microsoft cloud security benchmark v2';

const CACHE_TTL_MS = 10 * 60 * 1000;
const RETRY_AFTER_FAILURE_MS = 60 * 1000;
const FAILING_CONTROL_LIMIT = 3;
const TOP_COST_SERVICE_LIMIT = 3;

export type ComplianceCount = { compliant: number; evaluated: number };

export type LivePortfolio = {
  observedAt: string;
  // Each section is null when its source could not be read.
  inventory: Record<string, { resources: number; regions: number }> | null;
  cost: {
    currency: string | null;
    total: number;
    byResourceType: Record<string, number>;
    topServices: Array<{ service: string; cost: number }>;
  } | null;
  compliance: {
    framework: string;
    overall: ComplianceCount;
    byResourceType: Record<string, ComplianceCount>;
    failingControls: Array<{ id: string; title: string; resources: number }>;
  } | null;
};

type ResourceGraphResponse<T> = { data: T[] };

type CostQueryResponse = {
  properties: {
    columns: Array<{ name: string }>;
    rows: unknown[][];
    nextLink?: string | null;
  };
};

const policyStates = `policyresources
| where type =~ 'microsoft.policyinsights/policystates'
| where tostring(properties.policyAssignmentName) =~ '${COMPLIANCE_ASSIGNMENT_NAME}'`;

async function queryResourceGraph<T>(
  token: string,
  subscriptionId: string,
  query: string
): Promise<T[]> {
  const response = await armRequest<ResourceGraphResponse<T>>(
    token,
    '/providers/Microsoft.ResourceGraph/resources?api-version=2022-10-01',
    { subscriptions: [subscriptionId], query }
  );
  return response.data;
}

async function readInventory(token: string, subscriptionId: string) {
  const types = serviceCatalogEntries
    .map((entry) => `'${entry.resourceType}'`)
    .join(', ');
  const rows = await queryResourceGraph<{
    type: string;
    resources: number;
    regions: number;
  }>(
    token,
    subscriptionId,
    `resources
| where type in~ (${types})
| summarize resources = count(), regions = array_length(make_set(tolower(location))) by type = tolower(type)`
  );

  return Object.fromEntries(
    rows.map((row) => [
      row.type,
      { resources: row.resources, regions: row.regions },
    ])
  );
}

async function readCost(
  token: string,
  subscriptionId: string
): Promise<NonNullable<LivePortfolio['cost']>> {
  const body = {
    type: 'ActualCost',
    timeframe: 'MonthToDate',
    dataset: {
      granularity: 'None',
      aggregation: { totalCost: { name: 'Cost', function: 'Sum' } },
      grouping: [
        { type: 'Dimension', name: 'ResourceType' },
        { type: 'Dimension', name: 'ServiceName' },
      ],
    },
  };
  const byResourceType: Record<string, number> = {};
  const byService: Record<string, number> = {};
  let currency: string | null = null;
  let total = 0;
  let path: string | null =
    `/subscriptions/${subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`;

  while (path) {
    const { properties }: CostQueryResponse = await armRequest(
      token,
      path,
      body
    );
    const column = (name: string) =>
      properties.columns.findIndex((col) => col.name === name);
    const [costCol, typeCol, serviceCol, currencyCol] = [
      column('Cost'),
      column('ResourceType'),
      column('ServiceName'),
      column('Currency'),
    ];

    for (const row of properties.rows) {
      const cost = Number(row[costCol]);
      const resourceType = String(row[typeCol]).toLowerCase();
      const service = String(row[serviceCol]);
      total += cost;
      byResourceType[resourceType] = (byResourceType[resourceType] ?? 0) + cost;
      byService[service] = (byService[service] ?? 0) + cost;
      currency ??= String(row[currencyCol]);
    }

    path = properties.nextLink
      ? properties.nextLink.replace(ARM_ENDPOINT, '')
      : null;
  }

  const topServices = Object.entries(byService)
    .map(([service, cost]) => ({ service, cost }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, TOP_COST_SERVICE_LIMIT);

  return { currency, total, byResourceType, topServices };
}

async function readCompliance(
  token: string,
  subscriptionId: string
): Promise<NonNullable<LivePortfolio['compliance']>> {
  // A resource is compliant only when every policy evaluated against it is,
  // which is how Azure Policy scores resource compliance.
  const [perType, controls] = await Promise.all([
    queryResourceGraph<{
      resourceType: string;
      evaluated: number;
      compliant: number;
    }>(
      token,
      subscriptionId,
      `${policyStates}
| extend resourceId = tolower(tostring(properties.resourceId)), resourceType = tolower(tostring(properties.resourceType)), state = tostring(properties.complianceState)
| summarize nonCompliant = countif(state =~ 'NonCompliant') by resourceId, resourceType
| summarize evaluated = count(), compliant = countif(nonCompliant == 0) by resourceType`
    ),
    queryResourceGraph<{ control: string; resources: number }>(
      token,
      subscriptionId,
      `${policyStates}
| where tostring(properties.complianceState) =~ 'NonCompliant'
| mv-expand control = properties.policyDefinitionGroupNames
| summarize by control = tostring(control), resourceId = tolower(tostring(properties.resourceId))
| summarize resources = count() by control
| top ${FAILING_CONTROL_LIMIT} by resources desc`
    ),
  ]);

  const byResourceType: Record<string, ComplianceCount> = {};
  const overall: ComplianceCount = { compliant: 0, evaluated: 0 };
  for (const row of perType) {
    byResourceType[row.resourceType] = {
      compliant: row.compliant,
      evaluated: row.evaluated,
    };
    overall.compliant += row.compliant;
    overall.evaluated += row.evaluated;
  }

  const failingControls = await Promise.all(
    controls.map(async ({ control, resources }) => {
      const metadata = await armRequest<{ properties: { title?: string } }>(
        token,
        `/providers/Microsoft.PolicyInsights/policyMetadata/${encodeURIComponent(control)}?api-version=2019-10-01`
      ).catch(() => null);
      return {
        id: control,
        title: metadata?.properties.title?.trim() || control,
        resources,
      };
    })
  );

  return {
    framework: COMPLIANCE_FRAMEWORK,
    overall,
    byResourceType,
    failingControls,
  };
}

async function settle<T>(label: string, work: Promise<T>): Promise<T | null> {
  try {
    return await work;
  } catch (error) {
    console.error(
      `[livePortfolio] ${label} unavailable:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

async function loadLivePortfolio(): Promise<LivePortfolio> {
  const observedAt = new Date().toISOString();
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  const token = subscriptionId
    ? await settle('Azure token', getAzureManagementToken())
    : null;

  if (!subscriptionId || !token) {
    return { observedAt, inventory: null, cost: null, compliance: null };
  }

  const [inventory, cost, compliance] = await Promise.all([
    settle('inventory', readInventory(token, subscriptionId)),
    settle('cost', readCost(token, subscriptionId)),
    settle('compliance', readCompliance(token, subscriptionId)),
  ]);

  return { observedAt, inventory, cost, compliance };
}

// ponytail: per-pod in-memory cache. Cost Management throttles per tenant and
// its data refreshes a few times a day; move to a shared cache if replicas grow.
let cached: { value: Promise<LivePortfolio>; expiresAt: number } | null = null;

export function resetLivePortfolioCache() {
  cached = null;
}

export async function getLivePortfolio(): Promise<LivePortfolio> {
  if (
    !shouldUseCrossplaneMockMode() &&
    !(await getServerSession(authOptions))
  ) {
    throw new Error('Unauthorized');
  }

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const value = loadLivePortfolio();
  cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  const portfolio = await value;
  if (!portfolio.inventory || !portfolio.cost || !portfolio.compliance) {
    cached = { value, expiresAt: Date.now() + RETRY_AFTER_FAILURE_MS };
  }
  return portfolio;
}
