import 'server-only';

import { DefaultAzureCredential } from '@azure/identity';

export const ARM_ENDPOINT = 'https://management.azure.com';

// Null when no Azure identity is configured (local dev without workload
// identity), so callers can report "unavailable" instead of failing.
export async function getAzureManagementToken(): Promise<string | null> {
  if (!process.env.AZURE_CLIENT_ID && !process.env.AZURE_TENANT_ID) {
    return null;
  }

  const credential = new DefaultAzureCredential();
  const token = await credential.getToken(`${ARM_ENDPOINT}/.default`);

  return token?.token || null;
}

export async function armRequest<T>(
  token: string,
  path: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(`${ARM_ENDPOINT}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `Azure request ${path.split('?')[0]} failed with status ${response.status}`
    );
  }

  return (await response.json()) as T;
}
