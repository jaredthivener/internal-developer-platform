import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/crossplane/resources/route';
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
    } as unknown);

    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/resources?group=s3.aws.m.upbound.io&version=v1beta1&plural=buckets'
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(mockListClusterCustomObject).toHaveBeenCalledWith(
      's3.aws.m.upbound.io',
      'v1beta1',
      'buckets'
    );

    expect(body.data).toHaveLength(1);
    expect(body.data[0].metadata.name).toBe('my-bucket');
  });
});
