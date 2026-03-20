export function shouldUseCrossplaneMockMode(): boolean {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.IDP_ALLOW_OFFLINE_K8S === 'true'
  );
}
