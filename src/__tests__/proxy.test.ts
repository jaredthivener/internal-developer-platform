// @vitest-environment node
import { NextRequest } from 'next/server';
// next 16.2.6 still exports the matcher helper under its pre-rename name.
import {
  getRedirectUrl,
  unstable_doesMiddlewareMatch,
} from 'next/experimental/testing/server';
import { getToken } from 'next-auth/jwt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import nextConfig from '../../next.config';
import { config, proxy } from '@/proxy';

vi.mock('next-auth/jwt', () => ({ getToken: vi.fn() }));

describe('proxy sign-in redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('IDP_ALLOW_OFFLINE_K8S', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends visitors without a session to sign-in with a same-origin callback', async () => {
    vi.mocked(getToken).mockResolvedValueOnce(null);

    const res = await proxy(
      new NextRequest('https://idp.example.com/resources/store01?tab=diff')
    );

    const redirect = new URL(getRedirectUrl(res) ?? '');
    expect(redirect.origin).toBe('https://idp.example.com');
    expect(redirect.pathname).toBe('/api/auth/signin');
    expect(redirect.searchParams.get('callbackUrl')).toBe(
      '/resources/store01?tab=diff'
    );
  });

  it('lets visitors with a valid session token through', async () => {
    vi.mocked(getToken).mockResolvedValueOnce({ sub: 'user-1' });

    const res = await proxy(new NextRequest('https://idp.example.com/'));

    expect(getRedirectUrl(res)).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('skips the check in offline mock mode', async () => {
    vi.stubEnv('IDP_ALLOW_OFFLINE_K8S', 'true');

    const res = await proxy(new NextRequest('https://idp.example.com/'));

    expect(getToken).not.toHaveBeenCalled();
    expect(getRedirectUrl(res)).toBeNull();
  });

  it.each(['/', '/catalog/azure-storage', '/resources/store01'])(
    'runs on page route %s',
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig, url })).toBe(
        true
      );
    }
  );

  it.each([
    '/api/auth/signin',
    '/api/crossplane/resources',
    '/_next/static/chunks/main.js',
    '/_next/image',
    '/favicon.ico',
  ])('does not run on %s (API routes enforce their own 401)', (url) => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig, url })).toBe(
      false
    );
  });
});
