import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getServerSession } from 'next-auth';
import {
  getLivePortfolio,
  resetLivePortfolioCache,
} from '@/lib/catalog/livePortfolio';
import { getAzureManagementToken } from '@/lib/azure/arm';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth/authOptions', () => ({ authOptions: {} }));
vi.mock('@/lib/azure/arm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/azure/arm')>()),
  getAzureManagementToken: vi.fn(),
}));

type Call = { url: string; body?: { query?: string } };

// Routes each Azure call to a canned response shaped like the real API
// (shapes captured from live calls against the dev subscription).
function azure(overrides: Partial<Record<string, () => Response>> = {}) {
  const calls: Call[] = [];
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200 });
  const routes: Record<string, () => Response> = {
    inventory: () =>
      json({
        data: [
          {
            type: 'microsoft.storage/storageaccounts',
            resources: 2,
            regions: 2,
          },
          {
            type: 'microsoft.containerservice/managedclusters',
            resources: 1,
            regions: 1,
          },
        ],
      }),
    complianceByType: () =>
      json({
        data: [
          {
            resourceType: 'microsoft.storage/storageaccounts',
            evaluated: 2,
            compliant: 1,
          },
          {
            resourceType: 'microsoft.containerservice/managedclusters',
            evaluated: 1,
            compliant: 0,
          },
        ],
      }),
    failingControls: () =>
      json({
        data: [
          { control: 'Azure_Security_Benchmark_v3.0_NS-2', resources: 2 },
          { control: 'Azure_Security_Benchmark_v3.0_DP-3', resources: 1 },
        ],
      }),
    cost: () =>
      json({
        properties: {
          columns: [
            { name: 'Cost' },
            { name: 'ResourceType' },
            { name: 'ServiceName' },
            { name: 'Currency' },
          ],
          rows: [
            [
              12.5,
              'microsoft.containerservice/managedclusters',
              'Azure Kubernetes Service',
              'USD',
            ],
            [
              3.25,
              'Microsoft.Compute/virtualMachines',
              'Virtual Machines',
              'USD',
            ],
            [0.75, 'microsoft.storage/storageaccounts', 'Storage', 'USD'],
            [0.5, 'microsoft.storage/storageaccounts', 'Bandwidth', 'USD'],
          ],
          nextLink: null,
        },
      }),
    metadata: () =>
      json({
        properties: {
          title: 'NS-2 Secure cloud services with network controls ',
        },
      }),
    ...overrides,
  };

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, body });
      const query: string = body?.query ?? '';
      if (url.includes('Microsoft.CostManagement')) return routes.cost();
      if (url.includes('policyMetadata')) return routes.metadata();
      if (query.startsWith('resources')) return routes.inventory();
      if (query.includes('policyDefinitionGroupNames'))
        return routes.failingControls();
      if (query.includes('policystates')) return routes.complianceByType();
      return new Response('unexpected', { status: 500 });
    })
  );
  return calls;
}

describe('getLivePortfolio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLivePortfolioCache();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('IDP_ALLOW_OFFLINE_K8S', '');
    vi.stubEnv('AZURE_SUBSCRIPTION_ID', 'sub-1');
    vi.mocked(getServerSession).mockResolvedValue({
      user: { name: 'u' },
    } as never);
    vi.mocked(getAzureManagementToken).mockResolvedValue('token-1');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('refuses to read Azure data without a session', async () => {
    const calls = azure();
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    await expect(getLivePortfolio()).rejects.toThrow('Unauthorized');
    expect(calls).toHaveLength(0);
  });

  it('reports inventory, cost and MCSB compliance from Azure', async () => {
    azure();

    const portfolio = await getLivePortfolio();

    expect(portfolio.inventory).toEqual({
      'microsoft.storage/storageaccounts': { resources: 2, regions: 2 },
      'microsoft.containerservice/managedclusters': {
        resources: 1,
        regions: 1,
      },
    });
    expect(portfolio.cost).toEqual({
      currency: 'USD',
      total: 17,
      byResourceType: {
        'microsoft.containerservice/managedclusters': 12.5,
        'microsoft.compute/virtualmachines': 3.25,
        'microsoft.storage/storageaccounts': 1.25,
      },
      topServices: [
        { service: 'Azure Kubernetes Service', cost: 12.5 },
        { service: 'Virtual Machines', cost: 3.25 },
        { service: 'Storage', cost: 0.75 },
      ],
    });
    expect(portfolio.compliance).toEqual({
      framework: 'Microsoft cloud security benchmark v2',
      overall: { compliant: 1, evaluated: 3 },
      byResourceType: {
        'microsoft.storage/storageaccounts': { compliant: 1, evaluated: 2 },
        'microsoft.containerservice/managedclusters': {
          compliant: 0,
          evaluated: 1,
        },
      },
      failingControls: [
        {
          id: 'Azure_Security_Benchmark_v3.0_NS-2',
          title: 'NS-2 Secure cloud services with network controls',
          resources: 2,
        },
        {
          id: 'Azure_Security_Benchmark_v3.0_DP-3',
          title: 'NS-2 Secure cloud services with network controls',
          resources: 1,
        },
      ],
    });
  });

  it('scopes every query to the subscription and the IDP assignment', async () => {
    const calls = azure();

    await getLivePortfolio();

    const graph = calls.filter((c) =>
      c.url.includes('Microsoft.ResourceGraph')
    );
    expect(graph).toHaveLength(3);
    for (const call of graph) {
      expect(call.body).toMatchObject({ subscriptions: ['sub-1'] });
    }
    for (const call of graph.filter((c) =>
      c.body?.query?.includes('policystates')
    )) {
      expect(call.body?.query).toContain("=~ 'idp-mcsb-v2'");
    }
    expect(
      calls.some((c) =>
        c.url.startsWith(
          'https://management.azure.com/subscriptions/sub-1/providers/Microsoft.CostManagement/query'
        )
      )
    ).toBe(true);
  });

  it('follows Cost Management paging so totals are complete', async () => {
    let page = 0;
    const calls = azure({
      cost: () => {
        page += 1;
        return new Response(
          JSON.stringify({
            properties: {
              columns: [
                { name: 'Cost' },
                { name: 'ResourceType' },
                { name: 'ServiceName' },
                { name: 'Currency' },
              ],
              rows: [
                [page, 'microsoft.storage/storageaccounts', 'Storage', 'USD'],
              ],
              nextLink:
                page === 1
                  ? 'https://management.azure.com/subscriptions/sub-1/providers/Microsoft.CostManagement/query?api-version=2023-11-01&$skiptoken=abc'
                  : null,
            },
          })
        );
      },
    });

    const portfolio = await getLivePortfolio();

    expect(portfolio.cost?.total).toBe(3);
    expect(
      calls.filter((c) => c.url.includes('CostManagement'))[1].url
    ).toContain('$skiptoken=abc');
  });

  it('marks only the failed source unavailable', async () => {
    azure({ cost: () => new Response('throttled', { status: 429 }) });

    const portfolio = await getLivePortfolio();

    expect(portfolio.cost).toBeNull();
    expect(portfolio.inventory).not.toBeNull();
    expect(portfolio.compliance).not.toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      '[livePortfolio] cost unavailable:',
      expect.stringContaining('429')
    );
  });

  it('falls back to the control ID when its title cannot be read', async () => {
    azure({ metadata: () => new Response('nope', { status: 404 }) });

    const portfolio = await getLivePortfolio();

    expect(portfolio.compliance?.failingControls[0].title).toBe(
      'Azure_Security_Benchmark_v3.0_NS-2'
    );
  });

  it('reports everything unavailable without an Azure identity', async () => {
    const calls = azure();
    vi.mocked(getAzureManagementToken).mockResolvedValueOnce(null);

    const portfolio = await getLivePortfolio();

    expect(portfolio).toMatchObject({
      inventory: null,
      cost: null,
      compliance: null,
    });
    expect(calls).toHaveLength(0);
  });

  it('reports everything unavailable when the credential throws', async () => {
    azure();
    vi.mocked(getAzureManagementToken).mockRejectedValueOnce(
      new Error('no identity')
    );

    await expect(getLivePortfolio()).resolves.toMatchObject({
      inventory: null,
    });
  });

  it('serves repeat requests from cache, and retries soon after a failure', async () => {
    vi.useFakeTimers();
    try {
      const calls = azure({
        cost: () => new Response('down', { status: 503 }),
      });

      await getLivePortfolio();
      const afterFirst = calls.length;
      await getLivePortfolio();
      expect(calls.length).toBe(afterFirst);

      vi.advanceTimersByTime(61_000);
      await getLivePortfolio();
      expect(calls.length).toBeGreaterThan(afterFirst);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a fully successful result for ten minutes', async () => {
    vi.useFakeTimers();
    try {
      const calls = azure();

      await getLivePortfolio();
      const afterFirst = calls.length;
      vi.advanceTimersByTime(9 * 60_000);
      await getLivePortfolio();
      expect(calls.length).toBe(afterFirst);

      vi.advanceTimersByTime(2 * 60_000);
      await getLivePortfolio();
      expect(calls.length).toBeGreaterThan(afterFirst);
    } finally {
      vi.useRealTimers();
    }
  });
});
