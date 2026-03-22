import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock auth early to bypass in dev
vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({ user: { id: 'dev-bypass' } }),
}));
import { POST } from '@/app/api/crossplane/resources/route';
import { getCustomObjectsApi } from '@/lib/crossplane/client';
import { getDesiredStateStore } from '@/lib/persistence/store';

vi.mock('@/lib/crossplane/client', () => ({
  getCustomObjectsApi: vi.fn(),
}));

vi.mock('@/lib/persistence/store', () => ({
  getDesiredStateStore: vi.fn(),
}));

vi.mock('@/lib/auth/authOptions', () => ({
  authOptions: {},
}));

describe('POST /api/crossplane/resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCustomObjectsApi).mockReset();
    vi.mocked(getDesiredStateStore).mockReturnValue({
      persistSubmission: vi.fn().mockResolvedValue(undefined),
      markSubmissionApplied: vi.fn().mockResolvedValue(undefined),
      markSubmissionFailed: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('should return 400 Bad Request if missing required payload parameters', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources',
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('should successfully create a custom resource and return 201', async () => {
    const mockPayload = {
      group: 's3.aws.m.upbound.io',
      version: 'v1beta1',
      plural: 'buckets',
      payload: {
        apiVersion: 's3.aws.m.upbound.io/v1beta1',
        kind: 'Bucket',
        metadata: { generateName: 'test-bucket-' },
        spec: { forProvider: { region: 'us-east-1' } },
      },
    };

    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources',
      {
        method: 'POST',
        body: JSON.stringify(mockPayload),
      }
    );

    const mockCreateClusterCustomObject = vi.fn().mockResolvedValueOnce({
      body: { metadata: { name: 'test-bucket-123' } },
    });

    vi.mocked(getCustomObjectsApi).mockReturnValueOnce({
      createClusterCustomObject: mockCreateClusterCustomObject,
    } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    const desiredStateStore =
      vi.mocked(getDesiredStateStore).mock.results[0]?.value;

    expect(mockCreateClusterCustomObject).toHaveBeenCalledWith({
      group: 's3.aws.m.upbound.io',
      version: 'v1beta1',
      plural: 'buckets',
      body: expect.objectContaining({
        metadata: expect.objectContaining({
          annotations: expect.objectContaining({
            'idp.jared.io/request-id': expect.any(String),
          }),
        }),
      }),
    });

    expect(body.requestId).toEqual(expect.any(String));
    expect(body.data.metadata.name).toBe('test-bucket-123');
    expect(desiredStateStore.persistSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: body.requestId,
        group: 's3.aws.m.upbound.io',
        version: 'v1beta1',
        plural: 'buckets',
        payload: expect.objectContaining({
          metadata: expect.objectContaining({
            annotations: expect.objectContaining({
              'idp.jared.io/request-id': body.requestId,
            }),
          }),
        }),
      })
    );
    expect(desiredStateStore.markSubmissionApplied).toHaveBeenCalledWith(
      body.requestId,
      expect.objectContaining({
        resourceName: 'test-bucket-123',
      })
    );
  });
});
