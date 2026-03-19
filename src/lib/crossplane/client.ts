import * as k8s from '@kubernetes/client-node';

let kubeConfigInstance: k8s.KubeConfig | null = null;

/**
 * Initializes and returns a singleton instance of the KubeConfig.
 * In a Next.js server environment, we want to ensure we load the KubeConfig appropriately.
 */
export function getKubeConfig(): k8s.KubeConfig {
  if (!kubeConfigInstance) {
    kubeConfigInstance = new k8s.KubeConfig();
    kubeConfigInstance.loadFromDefault();
  }
  return kubeConfigInstance;
}

/**
 * Retrieves the CustomObjectsApi client.
 * Crossplane mainly interacts with the cluster via Custom Resource Definitions (CRDs).
 */
export function getCustomObjectsApi(): k8s.CustomObjectsApi {
  const kc = getKubeConfig();
  return kc.makeApiClient(k8s.CustomObjectsApi);
}
