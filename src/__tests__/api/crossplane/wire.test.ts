// @vitest-environment node
//
// Drives the API routes through a real @kubernetes/client-node CustomObjectsApi
// pointed at a local HTTP server, so assertions cover the requests that
// actually go over the wire instead of the shape of a hand-written mock.
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import * as k8s from '@kubernetes/client-node';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { GET as getCompositions } from '@/app/api/crossplane/compositions/route';
import { PATCH, POST } from '@/app/api/crossplane/resources/route';
import { getCustomObjectsApi } from '@/lib/crossplane/client';
import { getDesiredStateStore } from '@/lib/persistence/store';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth/authOptions', () => ({ authOptions: {} }));
vi.mock('@/lib/crossplane/client', () => ({ getCustomObjectsApi: vi.fn() }));
vi.mock('@/lib/persistence/store', () => ({ getDesiredStateStore: vi.fn() }));

type CapturedRequest = {
  method?: string;
  url?: string;
  contentType?: string;
  body: string;
};

let server: http.Server;
let captured: CapturedRequest[];
let reply: { status: number; body: unknown };

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      captured.push({
        method: req.method,
        url: req.url,
        contentType: req.headers['content-type'],
        body,
      });
      res.statusCode = reply.status;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(reply.body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  captured = [];
  reply = { status: 200, body: {} };
  vi.mocked(getServerSession).mockResolvedValue({
    user: { name: 'Test User' },
  });
  vi.mocked(getDesiredStateStore).mockReturnValue({
    persistSubmission: vi.fn().mockResolvedValue(undefined),
    markSubmissionApplied: vi.fn().mockResolvedValue(undefined),
    markSubmissionFailed: vi.fn().mockResolvedValue(undefined),
  });

  const kubeConfig = new k8s.KubeConfig();
  kubeConfig.loadFromOptions({
    clusters: [
      {
        name: 'test',
        server: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        skipTLSVerify: true,
      },
    ],
    users: [{ name: 'test' }],
    contexts: [{ name: 'test', cluster: 'test', user: 'test' }],
    currentContext: 'test',
  });
  vi.mocked(getCustomObjectsApi).mockReturnValue(
    kubeConfig.makeApiClient(k8s.CustomObjectsApi)
  );
});

function jsonRequest(method: string, body: unknown) {
  return new NextRequest('http://localhost:3000/api/crossplane/resources', {
    method,
    body: JSON.stringify(body),
  });
}

function kubernetesStatus(code: number, message: string) {
  return { kind: 'Status', status: 'Failure', message, code };
}

describe('Kubernetes requests on the wire', () => {
  it('lists compositions with GET and returns the items', async () => {
    reply.body = { items: [{ metadata: { name: 'xstorage' } }] };

    const res = await getCompositions(
      new NextRequest('http://localhost:3000/api/crossplane/compositions')
    );

    expect(captured).toEqual([
      expect.objectContaining({
        method: 'GET',
        url: '/apis/apiextensions.crossplane.io/v1/compositions',
      }),
    ]);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([
      { metadata: { name: 'xstorage' } },
    ]);
  });

  it('sends PATCH as a JSON merge patch to the named resource', async () => {
    const patch = {
      metadata: { annotations: { 'idp.jared.io/sync': 'now' } },
    };
    reply.body = { metadata: { name: 'devstorealpha01' } };

    const res = await PATCH(
      jsonRequest('PATCH', {
        group: 'storage.azure.upbound.io',
        version: 'v1beta1',
        plural: 'accounts',
        name: 'devstorealpha01',
        patch,
      })
    );

    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({
      method: 'PATCH',
      url: '/apis/storage.azure.upbound.io/v1beta1/accounts/devstorealpha01',
      contentType: 'application/merge-patch+json',
    });
    expect(JSON.parse(captured[0].body)).toEqual(patch);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({
      metadata: { name: 'devstorealpha01' },
    });
  });

  it('maps a 409 Status from the API server to a 409 with its message', async () => {
    reply = {
      status: 409,
      body: kubernetesStatus(
        409,
        'accounts.storage.azure.upbound.io "taken01" already exists'
      ),
    };

    const res = await POST(
      jsonRequest('POST', {
        group: 'storage.azure.upbound.io',
        version: 'v1beta1',
        plural: 'accounts',
        payload: { metadata: { name: 'taken01' } },
      })
    );

    expect(captured[0]).toMatchObject({
      method: 'POST',
      url: '/apis/storage.azure.upbound.io/v1beta1/accounts',
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe(
      'accounts.storage.azure.upbound.io "taken01" already exists'
    );
  });

  it('hides API server details on a 5xx response', async () => {
    reply = {
      status: 500,
      body: kubernetesStatus(500, 'etcdserver: request timed out'),
    };

    const res = await POST(
      jsonRequest('POST', {
        group: 'storage.azure.upbound.io',
        version: 'v1beta1',
        plural: 'accounts',
        payload: { metadata: { name: 'store01' } },
      })
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal Server Error' });
  });
});
