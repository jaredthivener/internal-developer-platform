import { NextResponse } from 'next/server';

// Kubelet liveness/readiness target. Unauthenticated and dependency-free so a
// probe never depends on sign-in redirects, Kubernetes, or Azure.
export function GET() {
  return NextResponse.json({ status: 'ok' });
}
