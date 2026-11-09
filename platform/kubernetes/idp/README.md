# IDP Kubernetes Manifests

This folder contains the Kubernetes manifests that publish the IDP web application inside the `idp-system` namespace. Flux deploys them (see [GitOps](#gitops)); nothing here is applied by hand.

## Files

- `base.yaml`: namespace, service account, RBAC, and the `idp-web` service.
- `deployment.yaml`: the `idp-web` deployment that runs the Next.js application.
- `gateway.yaml`: the public HTTPS entry point: a Gateway API `Gateway` on the AKS application routing implementation, an `HTTPRoute` to the `idp-web` service, and an HTTP-to-HTTPS redirect.
- `certificate.yaml`: the `DefaultDomainCertificate` that has AKS write the managed default-domain certificate to the Gateway's Secret.

## GitOps

The deploy script creates an AKS Flux configuration (`idp-platform`, namespace `cluster-config`), which installs the `microsoft.flux` cluster extension on first use. It syncs this repository's branch and applies `platform/gitops/clusters/idp-aks-auto`, which declares four Flux `Kustomization`s:

| Kustomization          | Path                             | Deploys                                                                     | Waits for                         |
| ---------------------- | -------------------------------- | --------------------------------------------------------------------------- | --------------------------------- |
| `crossplane`           | `platform/kubernetes/crossplane` | Crossplane `HelmRelease` (chart 2.4.3) with the AKS Automatic settings      | Helm release healthy              |
| `crossplane-providers` | `platform/crossplane/providers`  | Azure provider packages (v2.8.0) and their workload identity runtime config | Providers Installed + Healthy     |
| `crossplane-configs`   | `platform/crossplane/configs`    | `ProviderConfig`, `ClusterProviderConfig`, smoke-test `ResourceGroup`       | Applied only                      |
| `idp`                  | `platform/kubernetes/idp`        | The portal, its Gateway and its managed certificate                         | Rollout and certificate Available |

Versions are pinned in Git; change them with a commit. Values that differ per cluster (Azure IDs, hostname, image) are `${...}` variables that Flux fills from the `idp-platform-settings` ConfigMap, which the deploy script writes. That ConfigMap carries `reconcile.fluxcd.io/watch: Enabled`, so a new image is applied as soon as the script updates it. Secrets never go through Git: the deploy script creates `idp-app-env` from Key Vault before Flux starts the app.

Flux deploys the branch as pushed, not your working copy, so the deploy script stops if the tracked branch has unpushed commits or uncommitted `platform/` changes. `scripts/azure/gitops.test.sh` (run in CI) renders every Kustomization offline and checks the result.

The extension enforces Flux multi-tenancy, so every Flux object lives in `cluster-config` and uses `targetNamespace` to install elsewhere. Check status with `kubectl -n cluster-config get kustomizations,helmreleases` or on the cluster's **GitOps** blade in the Azure portal.

## How Public Access Works

The IDP is published over HTTPS through the AKS application routing Gateway API implementation (GatewayClass `approuting-istio`).

1. The host is `idp.<id>.<region>.aksapp.io`, one label under the cluster's app routing default domain. AKS assigns that domain once per cluster and keeps it across disable and re-enable, so reruns keep the host. The managed `external-dns` (in `app-routing-system`) publishes the A record from the `HTTPRoute` hostnames.
2. The HTTPS listener terminates TLS with the managed, publicly trusted wildcard certificate for `*.<id>.<region>.aksapp.io`.
3. The `idp-web` `HTTPRoute` forwards traffic to the `idp-web` service on port `80`, then to the container on port `3000`. Plain HTTP gets a 301 to HTTPS.

## TLS

AKS issues and renews the default domain's wildcard certificate and writes it to the Secret `idp-web-tls`, as the `DefaultDomainCertificate` in `certificate.yaml` asks. Flux counts the `idp` Kustomization ready only once that resource's `Available` condition is `True`. If it stays `CertificateNotReady`, run `kubectl -n idp-system describe defaultdomaincertificate idp-web-tls`; if the host does not resolve, check `kubectl -n app-routing-system logs deployment/default-domain-dns-external-dns`.

The default domain is an AKS preview feature, available in [these regions](https://learn.microsoft.com/azure/aks/app-routing-default-domain#supported-regions). A custom domain is not supported by this setup: the managed certificate only covers `*.aksapp.io`.

## Deploy Inputs

Everything has a working default; `npm run azure:up` needs no inputs.

| Variable          | Default                | Override when                                            |
| ----------------- | ---------------------- | -------------------------------------------------------- |
| `GITOPS_REPO_URL` | the `origin` remote    | Flux should sync a different (public, https) repository. |
| `GITOPS_BRANCH`   | the checked-out branch | Flux should track another pushed branch, such as `main`. |

`NEXTAUTH_URL` is `https://$INGRESS_HOST` (override with `NEXTAUTH_EXTERNAL_URL`, which must be `https`). The deploy script registers `https://<host>/api/auth/callback/azure-ad` on the portal app registration.

## Identity

No client secrets are issued for Azure access. `scripts/azure/bootstrap-aks-control-plane.sh` creates two user-assigned managed identities, each federated with a single Kubernetes service account through AKS workload identity:

| Identity               | Service account                                                                                         | Azure roles                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `<cluster>-crossplane` | `crossplane-system/provider-azure` (all Azure provider pods, via the default `DeploymentRuntimeConfig`) | `Contributor` on `CROSSPLANE_ROLE_SCOPE` (default: subscription)                                                                                |
| `<cluster>-idp-web`    | `idp-system/idp-web`                                                                                    | `Storage Blob Data Contributor` on the desired-state account, `Reader` on `CROSSPLANE_ROLE_SCOPE`, `Cost Management Reader` on the subscription |

Crossplane still needs subscription scope by default because it creates resource groups. Narrow `CROSSPLANE_ROLE_SCOPE` once resource groups are pre-provisioned.

## Live Catalog Data

The dashboard and catalog read live figures from Azure as the `idp-web` identity and cache them in memory for 10 minutes (1 minute after a failed read). A source that cannot be read is shown as unavailable; nothing is estimated.

| Figure                          | Source                                                                    |
| ------------------------------- | ------------------------------------------------------------------------- |
| Resources and regions           | Azure Resource Graph, per catalog resource type                           |
| Cost, month to date             | Azure Cost Management (actual cost; usage can take up to a day to appear) |
| Compliance and failing controls | Azure Policy states for the `idp-mcsb-v2` assignment, via Resource Graph  |

The bootstrap assigns the built-in **Microsoft cloud security benchmark v2** initiative to the subscription as `idp-mcsb-v2` with enforcement mode `DoNotEnforce`, so it only audits: nothing is blocked or remediated. Azure requires a managed identity on the assignment because some member policies can remediate; it is given no role. A resource counts as compliant only when every evaluated policy is compliant, which matches Azure Policy's own resource summary. The first evaluation takes about 30 minutes after assignment.

## Desired-State Storage

The bootstrap script creates a storage account tagged `idp-role=desired-state` (shared keys disabled, TLS 1.2, blob versioning and 30-day soft delete) and a `desired-state` container. The deploy script writes its blob endpoint into the `idp-app-env` secret. In production the app refuses to start a submission without this store rather than silently writing to the pod filesystem.

## App Secret

The `idp-app-env` secret is built only from the platform Key Vault (`nextauth-secret`, `portal-client-secret`) and computed values (app ID, tenant, URL, desired-state store). No local env file is read, so development settings such as `IDP_ALLOW_OFFLINE_K8S` cannot reach a cluster. `scripts/azure/scripts.test.sh` (run in CI) checks the exact key set.

## Pod Hardening

`deployment.yaml` runs as UID 65532 with `runAsNonRoot`, a read-only root filesystem (`emptyDir` mounts for `/app/.next/cache` and `/tmp`), no privilege escalation, all capabilities dropped, and the `RuntimeDefault` seccomp profile. Probes target the unauthenticated `/api/health` route.

## Access Control

Every API route requires a NextAuth session, and pages redirect signed-out visitors to Entra sign-in. The bootstrap sets **assignment required** on the portal's enterprise application and assigns the operator who ran it; assign further users or groups there.

## Ingress Controller Lifecycle

Microsoft supports the application routing NGINX ingress only through November 2026. This folder uses the application routing Gateway API implementation instead, so no migration is pending. The app routing add-on is enabled only for its default domain, with `--nginx None`, so it runs no NGINX controller. A new AKS Automatic 1.37 cluster has that implementation enabled but not the managed Gateway API CRDs (observed: `ingressProfile.gatewayApi.installation` was `null`), so the deploy script turns on `--enable-gateway-api` when it is missing.

## AKS Automatic Constraints

These AKS Automatic admission rules shaped the manifests (all observed on 1.37):

- `aks-managed-block-webhook-configs-targeting-protected-resources` rejects webhooks matching `*` resources, so Crossplane runs with `--enable-usages=false` (see its `HelmRelease`).
- The admissions enforcer adds system-namespace exclusions to webhook `namespaceSelector`s and owns that field. Flux's helm-controller applies server-side and forces conflicts, so chart upgrades are not blocked.
