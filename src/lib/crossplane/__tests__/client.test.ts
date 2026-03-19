import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as k8s from '@kubernetes/client-node';
import { getKubeConfig, getCustomObjectsApi } from '../client';

vi.mock('@kubernetes/client-node', () => {
  const mockLoadFromDefault = vi.fn();
  const mockMakeApiClient = vi.fn().mockReturnValue({});

  const mockKubeConfig = vi.fn().mockImplementation(function () {
    return {
      loadFromDefault: mockLoadFromDefault,
      makeApiClient: mockMakeApiClient,
    };
  });

  return {
    KubeConfig: mockKubeConfig,
    CustomObjectsApi: vi.fn(),
  };
});

describe('Crossplane K8s Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize and load default kubeconfig', () => {
    const kc = getKubeConfig();
    expect(kc).toBeDefined();
    expect(kc.loadFromDefault).toHaveBeenCalledOnce();
  });

  it('should create a CustomObjectsApi client', () => {
    const api = getCustomObjectsApi();
    expect(api).toBeDefined();

    // Verify makeApiClient was called with CustomObjectsApi class
    const kc = getKubeConfig(); // This will get the cached instance or create a new one, but we mainly care that makeApiClient was used contextually
    expect(kc.makeApiClient).toHaveBeenCalledWith(k8s.CustomObjectsApi);
  });
});
