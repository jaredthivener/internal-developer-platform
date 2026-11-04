import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth/authOptions';
import { shouldUseCrossplaneMockMode } from '@/lib/crossplane/offlineMode';

/**
 * Route-handler auth gate. Returns a 401 response when the caller has no
 * session, or null when the request may proceed.
 *
 * Mock mode is exempt because it never reaches the cluster or Azure; it exists
 * for local development and the e2e suite, which have no Entra tenant. The
 * deploy script refuses to ship IDP_ALLOW_OFFLINE_K8S to a cluster.
 */
export async function requireSession(): Promise<NextResponse | null> {
  if (shouldUseCrossplaneMockMode()) {
    return null;
  }

  const session = await getServerSession(authOptions);

  return session
    ? null
    : NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
