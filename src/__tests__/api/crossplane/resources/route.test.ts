import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE, GET, PATCH, POST } from '@/app/api/crossplane/resources/route';
import { getServerSession } from 'next-auth';
import { getCustomObjectsApi } from '@/lib/crossplane/client';
import { getDesiredStateStore } from '@/lib/persistence/store';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/crossplane/client', () => ({
  getCustomObjectsApi: vi.fn(),
}));

vi.mock('@/lib/persistence/store', () => ({
  getDesiredStateStore: vi.fn(),
}));

vi.mock('@/lib/auth/authOptions', () => ({
  authOptions: {},
}));

describe('GET /api/crossplane/resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDesiredStateStore).mockReturnValue({
      persistSubmission: vi.fn().mockResolvedValue(undefined),
      markSubmissionApplied: vi.fn().mockResolvedValue(undefined),
      markSubmissionFailed: vi.fn().mockResolvedValue(undefined),
    });
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

  it('should return a ready mock resource group in offline mode for the storage workflow', async () => {
    const originalFlag = process.env.IDP_ALLOW_OFFLINE_K8S;
    process.env.IDP_ALLOW_OFFLINE_K8S = 'true';

    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources?group=azure.m.upbound.io&version=v1beta1&plural=resourcegroups'
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([
      {
        metadata: { name: 'idp-crossplane-smoke' },
        status: {
          conditions: [{ type: 'Ready', status: 'True' }],
        },
      },
    ]);

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

describe('PATCH /api/crossplane/resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 Bad Request if missing required patch parameters', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources',
      {
        method: 'PATCH',
        body: JSON.stringify({}),
      }
    );

    const res = await PATCH(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Missing required body parameters');
  });

  it('should patch a managed resource and return 200', async () => {
    const mockPatchClusterCustomObject = vi.fn().mockResolvedValueOnce({
      body: { metadata: { name: 'devstorealpha01' } },
    });

    vi.mocked(getCustomObjectsApi).mockReturnValueOnce({
      patchClusterCustomObject: mockPatchClusterCustomObject,
    } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    const patch = {
      metadata: {
        annotations: {
          'idp.jared.io/last-sync-requested-at': '2026-03-22T20:05:00Z',
        },
      },
      spec: {
        forProvider: {
          accountReplicationType: 'LRS',
        },
      },
    };

    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources',
      {
        method: 'PATCH',
        body: JSON.stringify({
          group: 'storage.azure.upbound.io',
          version: 'v1beta1',
          plural: 'accounts',
          name: 'devstorealpha01',
          patch,
        }),
      }
    );

    const res = await PATCH(req);

    expect(res.status).toBe(200);
    expect(mockPatchClusterCustomObject).toHaveBeenCalledWith(
      'storage.azure.upbound.io',
      'v1beta1',
      'accounts',
      'devstorealpha01',
      patch,
      undefined,
      undefined,
      undefined,
      undefined,
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/merge-patch+json',
        }),
      })
    );
    const body = await res.json();
    expect(body.data).toEqual({ metadata: { name: 'devstorealpha01' } });
  });

  it('should return mocked success when offline mode is enabled', async () => {
    const originalFlag = process.env.IDP_ALLOW_OFFLINE_K8S;
    process.env.IDP_ALLOW_OFFLINE_K8S = 'true';

    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources',
      {
        method: 'PATCH',
        body: JSON.stringify({
          group: 'storage.azure.upbound.io',
          version: 'v1beta1',
          plural: 'accounts',
          name: 'devstorealpha01',
          patch: {
            metadata: {
              annotations: {
                'idp.jared.io/last-sync-requested-at': '2026-03-22T20:05:00Z',
              },
            },
          },
        }),
      }
    );

    const res = await PATCH(req);
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
    vi.mocked(getDesiredStateStore).mockReturnValue({
      persistSubmission: vi.fn().mockResolvedValue(undefined),
      markSubmissionApplied: vi.fn().mockResolvedValue(undefined),
      markSubmissionFailed: vi.fn().mockResolvedValue(undefined),
    });
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
    const desiredStateStore =
      vi.mocked(getDesiredStateStore).mock.results[0]?.value;
    expect(mockCreateClusterCustomObject).toHaveBeenCalledWith({
      group: 'storage.azure.upbound.io',
      version: 'v1beta1',
      plural: 'accounts',
      body: expect.objectContaining({
        metadata: expect.objectContaining({
          annotations: expect.objectContaining({
            'idp.jared.io/request-id': expect.any(String),
          }),
        }),
      }),
    });
    expect(body.requestId).toEqual(expect.any(String));
    expect(body.data).toEqual({ metadata: { name: 'devstorealpha01' } });
    expect(desiredStateStore.persistSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: body.requestId,
        group: 'storage.azure.upbound.io',
        version: 'v1beta1',
        plural: 'accounts',
      })
    );
    expect(desiredStateStore.markSubmissionApplied).toHaveBeenCalledWith(
      body.requestId,
      expect.objectContaining({
        resourceName: 'devstorealpha01',
      })
    );
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

  it('should mark the submission as failed when the Kubernetes create call errors', async () => {
    const mockCreateClusterCustomObject = vi.fn().mockRejectedValueOnce({
      body: { code: 500, message: 'cluster create failed' },
    });

    vi.mocked(getCustomObjectsApi).mockReturnValueOnce({
      createClusterCustomObject: mockCreateClusterCustomObject,
    } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources',
      {
        method: 'POST',
        body: JSON.stringify({
          group: 'storage.azure.upbound.io',
          version: 'v1beta1',
          plural: 'accounts',
          payload: {
            apiVersion: 'storage.azure.upbound.io/v1beta1',
            kind: 'Account',
            metadata: { name: 'brokenstorage01' },
          },
        }),
      }
    );

    const res = await POST(req);

    expect(res.status).toBe(500);
    const desiredStateStore =
      vi.mocked(getDesiredStateStore).mock.results[0]?.value;
    expect(desiredStateStore.persistSubmission).toHaveBeenCalledTimes(1);
    expect(desiredStateStore.markSubmissionFailed).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        error: 'cluster create failed',
      })
    );
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
