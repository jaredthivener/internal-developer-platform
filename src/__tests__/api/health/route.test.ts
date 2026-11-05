// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import nextConfig from '../../../../next.config';
import { GET } from '@/app/api/health/route';
import { config } from '@/proxy';

describe('GET /api/health', () => {
  it('answers 200 without a session so kubelet probes never hit sign-in', async () => {
    const res = GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    expect(
      unstable_doesMiddlewareMatch({ config, nextConfig, url: '/api/health' })
    ).toBe(false);
  });
});
