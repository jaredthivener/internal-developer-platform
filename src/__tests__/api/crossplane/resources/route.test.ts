import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE, GET, POST } from '@/app/api/crossplane/resources/route';
import { getServerSession } from 'next-auth';
import { getCustomObjectsApi } from '@/lib/crossplane/client';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/crossplane/client', () => ({
  getCustomObjectsApi: vi.fn(),
}));

vi.mock('@/lib/auth/authOptions', () => ({
  authOptions: {},
}));

describe('GET /api/crossplane/resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.skip('should return 401 Unauthorized if user is not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources?group=s3.aws.m.upbound.io&version=v1beta1&plural=buckets'
    );
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('should return 400 Bad Request if missing required query parameters', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { name: 'Test User' },
    });

    // Missing 'plural' parameter
    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources?group=s3.aws.m.upbound.io&version=v1beta1'
    );
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Missing required query parameters');
  });

  it('should return 200 with data on successful fetch', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { name: 'Test User' },
    });

    const mockK8sResponse = {
      body: {
        items: [
          {
            metadata: { name: 'my-bucket' },
            status: { conditions: [{ type: 'Ready', status: 'True' }] },
          },
        ],
      },
    };

    const mockListClusterCustomObject = vi
      .fn()
      .mockResolvedValueOnce(mockK8sResponse);
    vi.mocked(getCustomObjectsApi).mockReturnValueOnce({
      listClusterCustomObject: mockListClusterCustomObject,
    } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources?group=s3.aws.m.upbound.io&version=v1beta1&plural=buckets'
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(mockListClusterCustomObject).toHaveBeenCalledWith({
      group: 's3.aws.m.upbound.io',
      version: 'v1beta1',
      plural: 'buckets',
    });

    expect(body.data).toHaveLength(1);
    expect(body.data[0].metadata.name).toBe('my-bucket');
  });

  it('should return 200 with data when the client returns items directly', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { name: 'Test User' },
    });

    const mockListClusterCustomObject = vi.fn().mockResolvedValueOnce({
      items: [
        {
          metadata: { name: 'my-direct-bucket' },
          status: { conditions: [{ type: 'Ready', status: 'True' }] },
        },
      ],
    });

    vi.mocked(getCustomObjectsApi).mockReturnValueOnce({
      listClusterCustomObject: mockListClusterCustomObject,
    } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources?group=s3.aws.m.upbound.io&version=v1beta1&plural=buckets'
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].metadata.name).toBe('my-direct-bucket');
  });

  it('should return a single resource when a name is provided', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { name: 'Test User' },
    });

    const mockGetClusterCustomObject = vi.fn().mockResolvedValueOnce({
      body: {
        metadata: { name: 'devstorealpha01' },
        status: { conditions: [{ type: 'Ready', status: 'True' }] },
      },
    });

    vi.mocked(getCustomObjectsApi).mockReturnValueOnce({
      getClusterCustomObject: mockGetClusterCustomObject,
    } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources?group=storage.azure.upbound.io&version=v1beta1&plural=accounts&name=devstorealpha01'
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(mockGetClusterCustomObject).toHaveBeenCalledWith({
      group: 'storage.azure.upbound.io',
      version: 'v1beta1',
      plural: 'accounts',
      name: 'devstorealpha01',
    });
    expect(body.data).toEqual({
      metadata: { name: 'devstorealpha01' },
      status: { conditions: [{ type: 'Ready', status: 'True' }] },
    });
  });

  it('should return mocked data when offline mode is enabled', async () => {
    const originalFlag = process.env.IDP_ALLOW_OFFLINE_K8S;
    process.env.IDP_ALLOW_OFFLINE_K8S = 'true';

    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources?group=storage.azure.upbound.io&version=v1beta1&plural=accounts'
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(getCustomObjectsApi).not.toHaveBeenCalled();

    if (originalFlag === undefined) {
      delete process.env.IDP_ALLOW_OFFLINE_K8S;
    } else {
      process.env.IDP_ALLOW_OFFLINE_K8S = originalFlag;
    }
  });
});

describe('DELETE /api/crossplane/resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 Bad Request if missing required delete parameters', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources',
      {
        method: 'DELETE',
        body: JSON.stringify({}),
      }
    );

    const res = await DELETE(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Missing required body parameters');
  });

  it('should delete a managed resource and return 200', async () => {
    const mockDeleteClusterCustomObject = vi.fn().mockResolvedValueOnce({
      body: { status: 'Success' },
    });

    vi.mocked(getCustomObjectsApi).mockReturnValueOnce({
      deleteClusterCustomObject: mockDeleteClusterCustomObject,
    } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources',
      {
        method: 'DELETE',
        body: JSON.stringify({
          group: 'storage.azure.upbound.io',
          version: 'v1beta1',
          plural: 'accounts',
          name: 'devstorealpha01',
        }),
      }
    );

    const res = await DELETE(req);

    expect(res.status).toBe(200);
    expect(mockDeleteClusterCustomObject).toHaveBeenCalledWith({
      group: 'storage.azure.upbound.io',
      version: 'v1beta1',
      plural: 'accounts',
      name: 'devstorealpha01',
    });
  });

  it('should return deleted resource data when the client returns the payload directly', async () => {
    const mockDeleteClusterCustomObject = vi.fn().mockResolvedValueOnce({
      status: 'Success',
    });

    vi.mocked(getCustomObjectsApi).mockReturnValueOnce({
      deleteClusterCustomObject: mockDeleteClusterCustomObject,
    } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources',
      {
        method: 'DELETE',
        body: JSON.stringify({
          group: 'storage.azure.upbound.io',
          version: 'v1beta1',
          plural: 'accounts',
          name: 'devstorealpha01',
        }),
      }
    );

    const res = await DELETE(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ status: 'Success' });
  });

  it('should return the upstream status and message when delete is forbidden', async () => {
    const mockDeleteClusterCustomObject = vi.fn().mockRejectedValueOnce({
      body: {
        code: 403,
        message:
          'accounts.storage.azure.upbound.io "devstorealpha01" is forbidden',
      },
    });

    vi.mocked(getCustomObjectsApi).mockReturnValueOnce({
      deleteClusterCustomObject: mockDeleteClusterCustomObject,
    } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources',
      {
        method: 'DELETE',
        body: JSON.stringify({
          group: 'storage.azure.upbound.io',
          version: 'v1beta1',
          plural: 'accounts',
          name: 'devstorealpha01',
        }),
      }
    );

    const res = await DELETE(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('forbidden');
  });

  it('should return mocked success when offline mode is enabled', async () => {
    const originalFlag = process.env.IDP_ALLOW_OFFLINE_K8S;
    process.env.IDP_ALLOW_OFFLINE_K8S = 'true';

    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources',
      {
        method: 'DELETE',
        body: JSON.stringify({
          group: 'storage.azure.upbound.io',
          version: 'v1beta1',
          plural: 'accounts',
          name: 'devstorealpha01',
        }),
      }
    );

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect(getCustomObjectsApi).not.toHaveBeenCalled();

    if (originalFlag === undefined) {
      delete process.env.IDP_ALLOW_OFFLINE_K8S;
    } else {
      process.env.IDP_ALLOW_OFFLINE_K8S = originalFlag;
    }
  });
});

describe('POST /api/crossplane/resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 Bad Request if missing required create parameters', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources',
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Missing required body parameters');
  });

  it('should create a managed resource and return 201', async () => {
    const mockCreateClusterCustomObject = vi.fn().mockResolvedValueOnce({
      body: { metadata: { name: 'devstorealpha01' } },
    });

    vi.mocked(getCustomObjectsApi).mockReturnValueOnce({
      createClusterCustomObject: mockCreateClusterCustomObject,
    } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    const payload = {
      apiVersion: 'storage.azure.upbound.io/v1beta1',
      kind: 'Account',
      metadata: { name: 'devstorealpha01' },
      spec: {
        providerConfigRef: {
          kind: 'ClusterProviderConfig',
          name: 'default',
        },
      },
    };

    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources',
      {
        method: 'POST',
        body: JSON.stringify({
          group: 'storage.azure.upbound.io',
          version: 'v1beta1',
          plural: 'accounts',
          payload,
        }),
      }
    );

    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(mockCreateClusterCustomObject).toHaveBeenCalledWith({
      group: 'storage.azure.upbound.io',
      version: 'v1beta1',
      plural: 'accounts',
      body: payload,
    });
    expect(body.data).toEqual({ metadata: { name: 'devstorealpha01' } });
  });

  it('should return created resource data when the client returns the payload directly', async () => {
    const mockCreateClusterCustomObject = vi.fn().mockResolvedValueOnce({
      metadata: { name: 'devstorebeta02' },
    });

    vi.mocked(getCustomObjectsApi).mockReturnValueOnce({
      createClusterCustomObject: mockCreateClusterCustomObject,
    } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    const payload = {
      apiVersion: 'storage.azure.upbound.io/v1beta1',
      kind: 'Account',
      metadata: { name: 'devstorebeta02' },
    };

    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources',
      {
        method: 'POST',
        body: JSON.stringify({
          group: 'storage.azure.upbound.io',
          version: 'v1beta1',
          plural: 'accounts',
          payload,
        }),
      }
    );

    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toEqual({ metadata: { name: 'devstorebeta02' } });
  });

  it('should return mocked success when offline mode is enabled', async () => {
    const originalFlag = process.env.IDP_ALLOW_OFFLINE_K8S;
    process.env.IDP_ALLOW_OFFLINE_K8S = 'true';

    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources',
      {
        method: 'POST',
        body: JSON.stringify({
          group: 'storage.azure.upbound.io',
          version: 'v1beta1',
          plural: 'accounts',
          payload: {
            metadata: { name: 'devstorealpha01' },
          },
        }),
      }
    );

    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(getCustomObjectsApi).not.toHaveBeenCalled();

    if (originalFlag === undefined) {
      delete process.env.IDP_ALLOW_OFFLINE_K8S;
    } else {
      process.env.IDP_ALLOW_OFFLINE_K8S = originalFlag;
    }
  });
});
