import { afterEach, describe, expect, it, vi } from 'vitest';

describe('authOptions secret', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('never falls back to a hardcoded secret, even in offline mode', async () => {
    vi.stubEnv('NEXTAUTH_SECRET', '');
    vi.stubEnv('IDP_ALLOW_OFFLINE_K8S', 'true');

    const { authOptions } = await import('@/lib/auth/authOptions');

    expect(authOptions.secret).toBeFalsy();
  });

  it('uses NEXTAUTH_SECRET when it is set', async () => {
    vi.stubEnv('NEXTAUTH_SECRET', 'from-the-environment');

    const { authOptions } = await import('@/lib/auth/authOptions');

    expect(authOptions.secret).toBe('from-the-environment');
  });

  it('uses the built-in sign-in page, which lives at /api/auth/signin', async () => {
    // Pointing pages.signIn at the built-in route makes next-auth redirect
    // /api/auth/signin to itself forever.
    const { authOptions } = await import('@/lib/auth/authOptions');

    expect(authOptions.pages?.signIn).toBeUndefined();
  });
});
