import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/crossplane/compositions/route';
import { getServerSession } from 'next-auth';
import { getCustomObjectsApi } from '@/lib/crossplane/client';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/crossplane/client', () => ({
  getCustomObjectsApi: vi.fn(),
}));

vi.mock('@/lib/auth/authOptions', () => ({
  authOptions: {},
}));

describe('GET /api/crossplane/compositions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.skip('should return 401 Unauthorized if user is not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/compositions'
    );
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('should return 500 if the kubernetes client throws an error (masks internal errors)', async () => {
    // Mock authenticated session
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { name: 'Test User' },
    });

    // Mock kubernetes failure
    const mockListClusterCustomObject = vi
      .fn()
      .mockRejectedValueOnce(new Error('K8s internal connection refused'));
    vi.mocked(getCustomObjectsApi).mockReturnValueOnce({
      listClusterCustomObject: mockListClusterCustomObject,
    } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/compositions'
    );
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    // We expect a generic error message, not the internal K8s error
    expect(body.error).toBe('Internal Server Error');
  });

  it('should return mocked data when offline mode is enabled', async () => {
    const originalFlag = process.env.IDP_ALLOW_OFFLINE_K8S;
    process.env.IDP_ALLOW_OFFLINE_K8S = 'true';

    const req = new NextRequest(
      'http://localhost:3000/api/crossplane/compositions'
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThan(0);
    expect(getCustomObjectsApi).not.toHaveBeenCalled();

    if (originalFlag === undefined) {
      delete process.env.IDP_ALLOW_OFFLINE_K8S;
    } else {
      process.env.IDP_ALLOW_OFFLINE_K8S = originalFlag;
    }
  });

  it('should return 200 with sanitized data on success', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { name: 'Test User' },
    });

    const mockK8sResponse = {
      body: {
        items: [
          {
            metadata: { name: 'example-composition' },
            spec: {
              compositeTypeRef: { apiVersion: 'test/v1', kind: 'XTest' },
            },
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
      'http://localhost:3000/api/crossplane/compositions'
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    // Verify client configuration args mapping for Crossplane
    expect(mockListClusterCustomObject).toHaveBeenCalledWith(
      'apiextensions.crossplane.io',
      'v1',
      'compositions'
    );

    expect(body.data).toHaveLength(1);
    expect(body.data[0].metadata.name).toBe('example-composition');
  });
});
