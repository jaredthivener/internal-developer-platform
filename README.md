# Internal Developer Portal (IDP)

A highly opinionated, secure, and developer-friendly IDP built with Next.js, React, Material UI, and Entra ID. The portal is designed to abstract platform operations behind an application-centric experience so developers can self-serve environments without dealing directly with raw infrastructure primitives.

## 🏗 Architecture & Stack

- **Frontend / Backend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Material UI (v7) with toggleable light and dark themes
- **Authentication**: Microsoft Entra ID (NextAuth.js) with RBAC
- **Infrastructure Engine**: Crossplane (via standard Kubernetes API interaction `@kubernetes/client-node`)
- **Testing**: Vitest, React Testing Library, custom Jest-DOM assertions. TDD enforced.
- **Code Quality**: Prettier, ESLint, Husky (Git Hooks)

## Key Features

- **Application-centric console:** Surfaces environments and platform capabilities without exposing Crossplane jargon in the primary UX.
- **Cluster insights:** Visualize cluster health, unpatched vulnerabilities, and drift.
- **Day 2 automation:** Support operational workflows such as upgrades, patches, and rollbacks through controlled platform actions.
- **Enterprise security:** Enforced security headers, restrictive browser policies, and Entra ID-backed access control.

## Documentation

- Product and engineering docs live in [docs](./docs).
- Local docs development: `npm run docs:dev`
- Static docs build: `npm run docs:build`
- Public docs site: GitHub Pages is configured to publish the Docusaurus site from GitHub Actions.

## Azure Bootstrap

Stand up the whole environment (cluster, identities, secrets, Crossplane, portal, TLS) with one command:

```bash
az login
az config set auto-upgrade.enable=no   # the scripts stop if az could prompt mid-run
npm run azure:up
```

`azure:up` runs the two scripts below in order; both are idempotent, so rerunning resumes or reconciles. No local secrets file is used: Entra and NextAuth secrets are generated straight into Key Vault.

```bash
bash scripts/azure/bootstrap-aks-control-plane.sh
```

What the script does:

- Creates a resource group in a supported AKS Automatic region.
- Creates an AKS Automatic cluster on the newest GA Kubernetes version AKS offers in the region (override with `KUBERNETES_VERSION`), with hosted system pools, OIDC issuer, and workload identity enabled.
- Adds a low-cost Arm64 Spot user node pool for non-critical workloads.
- Creates two user-assigned managed identities federated through workload identity (no client secrets): one for the Crossplane Azure providers and one for the IDP web app.
- Creates the desired-state storage account (shared keys disabled, versioning and soft delete on) and grants the IDP identity `Storage Blob Data Contributor` on it.
- Creates the platform Key Vault (tag `idp-role=platform-secrets`) and the Entra app registration `<cluster>-portal`. The client secret and `NEXTAUTH_SECRET` are written directly to Key Vault and never printed.
- Turns on **assignment required** for the portal's enterprise application and assigns the signed-in operator; assign more users or groups in Entra to grant access.
- Assigns the built-in **Microsoft cloud security benchmark v2** initiative to the subscription in audit-only mode (`DoNotEnforce`) and grants the IDP identity `Cost Management Reader`, so the dashboard and catalog show live compliance and month-to-date cost. See [platform/kubernetes/idp/README.md](platform/kubernetes/idp/README.md#live-catalog-data).

Important:

- Reruns keep an existing cluster's version. The portal only uses the version-independent `CustomObjectsApi` of `@kubernetes/client-node`, so it does not constrain the cluster version. AKS upgrades one minor version at a time; the bootstrap does not upgrade for you.
- If the cluster is recreated, the bootstrap repoints the federated credentials at the new cluster's OIDC issuer.
- Crossplane's identity gets `Contributor` on `CROSSPLANE_ROLE_SCOPE` (default: the subscription, because it creates resource groups). Narrow it once resource groups are pre-provisioned.
- Managed system capacity remains on the hosted automatic/system side. The Arm64 Spot pool is for cheaper workload scheduling and should not be the only capacity for critical recovery paths.
- AKS Automatic hosted system node pools are currently preview and region-limited. The script validates the Azure CLI prereqs and preview feature registration before cluster creation.

## AKS Deployment

After the cluster exists, deploy with:

```bash
bash scripts/azure/deploy-platform-to-aks.sh
```

Everything inside the cluster is deployed by **Flux** (the AKS GitOps extension, `microsoft.flux`) from this repository: Crossplane as a `HelmRelease`, the Crossplane providers and configs, and the portal. Flux syncs the branch you have checked out, as pushed to `origin`, so commit and push before deploying; the script stops if your branch has unpushed commits or uncommitted `platform/` changes. Set `GITOPS_BRANCH=main` to track another pushed branch.

The portal is always published on HTTPS (Entra ID only accepts `https` redirect URIs), at `idp.<id>.<region>.aksapp.io` under the cluster's [app routing default domain](https://learn.microsoft.com/azure/aks/app-routing-default-domain): AKS owns that domain, its trusted wildcard certificate and its DNS records. The default domain is an AKS preview feature (no SLA); the bootstrap registers its `DefaultDomainPreview` flag.

What the deploy script does:

- Reuses an existing ACR from the target resource group when one already exists, otherwise creates a new Basic ACR and attaches it to the AKS cluster.
- Builds the Next.js app as a standalone container image and pushes it to ACR.
- Enables the managed Gateway API, the application routing Gateway implementation (`approuting-istio`) and the app routing add-on with its default domain (no NGINX) if missing.
- Registers `https://<host>/api/auth/callback/azure-ad` on the portal app registration.
- Creates the app's secret from Key Vault and writes the per-cluster values Flux substitutes (Azure IDs, hostname, image) to the `idp-platform-settings` ConfigMap.
- Creates (or repoints) the Flux configuration `idp-platform`, then waits until every Flux `Kustomization` is ready and the new image is rolled out.

What Flux deploys (versions pinned in Git; see [platform/kubernetes/idp/README.md](platform/kubernetes/idp/README.md#gitops)):

- Crossplane 2.4.3 into `crossplane-system`, the Azure provider packages v2.8.0 (resource groups, networking, storage, PostgreSQL, AKS), workload identity `ProviderConfig`/`ClusterProviderConfig` objects and a smoke-test `ResourceGroup`.
- The portal in `idp-system`, its TLS `Gateway` with an HTTP-to-HTTPS redirect, and a `DefaultDomainCertificate` that has AKS put the managed certificate in the Gateway's Secret.

Important deploy behavior:

- If `ACR_NAME` is unset and the resource group already contains exactly one Azure Container Registry, the script reuses that registry for subsequent runs.
- If `ACR_NAME` is unset and the resource group contains no registries, the script creates a new one.
- If `ACR_NAME` is unset and the resource group contains multiple registries, the script fails fast and requires an explicit `ACR_NAME`.
- `NEXTAUTH_URL` in the cluster secret is set to `https://<INGRESS_HOST>` unless `NEXTAUTH_EXTERNAL_URL` (also `https`) is given.
- The app's Kubernetes secret is built only from Key Vault and computed values, so local settings such as `IDP_ALLOW_OFFLINE_K8S` can never reach a cluster.

For a manifest-level explanation of how the service, deployment, and Gateway work together, see [platform/kubernetes/idp/README.md](./platform/kubernetes/idp/README.md).

Starter assumptions:

- The app's Kubernetes RBAC is read-only except for create, delete, and patch on `storage.azure.upbound.io` `accounts`. The API additionally rejects any resource type outside its allowlist (`src/lib/crossplane/allowedResources.ts`).
- Every API route requires a signed-in session, and only users assigned to the portal's enterprise application can sign in.

## Teardown

```bash
npm run azure:down            # asks you to type the resource group name
npm run azure:down -- --yes   # no prompt
```

`scripts/azure/teardown-aks-platform.sh` removes everything `azure:up` creates, in an order that leaves nothing behind:

1. Suspends Flux, then deletes every Crossplane managed resource so the providers delete the Azure resources they created (portal-created storage accounts and the smoke-test resource group included). It stops if any remain; set `SKIP_MANAGED_RESOURCE_CLEANUP=true` only when the cluster is broken and you have handled them yourself.
2. Deletes every role assignment of the Crossplane and portal identities, at any scope, before the identities themselves; otherwise subscription-scope assignments stay behind as orphans.
3. Deletes the `idp-mcsb-v2` policy assignment and the portal's Entra app registration (purged, not just soft-deleted).
4. Deletes the resource group (cluster, node resource group, registry, storage, Key Vault, identities), then purges the Key Vault unless purge protection is on.
5. Deletes the default Azure Monitor workspace AKS created for managed Prometheus, and its `DefaultResourceGroup-*` when empty, but only when no other data collection rule uses it. Azure removes its managed `MA_*` resource group with it.
6. Removes the cluster's kubeconfig entries.

A rerun after a full teardown changes nothing. It uses the same `RESOURCE_GROUP`, `AKS_CLUSTER_NAME`, `LOCATION` and identity/app name variables as the bootstrap.

## Storage Account Dev Workflow

After the AKS platform deploy completes:

1. Open the portal at `https://<INGRESS_HOST>` and sign in with Entra ID.
2. Use the `Azure Storage Account Workflow` form in the Azure resource catalog.
3. Submit a dev-safe request targeting the default smoke-test resource group `idp-crossplane-smoke`, or another existing resource group that Crossplane can write to.

The workflow creates this managed resource type on the cluster:

```yaml
apiVersion: storage.azure.upbound.io/v1beta1
kind: Account
```

You can also test the same workflow directly from the cluster side:

```bash
sed \
	-e "s/STORAGE_ACCOUNT_NAME_PLACEHOLDER/devstorealpha01/" \
	-e "s/RESOURCE_GROUP_PLACEHOLDER/idp-crossplane-smoke/" \
	-e "s/LOCATION_PLACEHOLDER/westus3/" \
	platform/crossplane/examples/storage-account-dev.yaml | kubectl apply -f -
```

Then inspect reconciliation with:

```bash
kubectl get accounts.storage.azure.upbound.io
kubectl describe account.storage.azure.upbound.io/devstorealpha01
```

## Getting Started

### 1. Prerequisites

- Node.js (v20+)
- `npm` (v10+)
- Access to a local or remote Kubernetes cluster with Crossplane installed.

### 2. Environment Setup

Copy the example environment variables and fill them in with your Entra ID credentials and Kubernetes context.

```bash
cp .env.example .env.local
```

### 3. Installation

```bash
npm install
```

### 4. Running the Dev Server

```bash
npm run dev
# Server will initialize on http://localhost:3000
```

For local UI verification without a live Kubernetes cluster or real Entra secret:

```bash
npm run dev:local
```

For a production-style local preview after building:

```bash
npm run build
npm run start:local
```

Notes:

- `npm run start` uses the standalone server output and expects a real `NEXTAUTH_SECRET` plus cluster connectivity.
- `npm run start:local` uses the standard Next.js production server for local preview. This avoids current standalone server issues with App Router routes on Next.js 16 while still serving the same production build output.
- `npm run start:local` and `npm run dev:local` enable offline Crossplane mocks so the Azure catalog and storage workflow render even when no active cluster is configured.

### 5. Running the Documentation Site

```bash
npm run docs:dev
```

The documentation site runs from the nested Docusaurus workspace in [docs](./docs).

## Roadmap

- Expand the application environment model so developers see AKS, storage, networking, and databases as one cohesive platform view.
- Add richer operational workflows and status visibility for platform-managed resources.
- Document architecture, local setup, deployment, and product concepts in the Docusaurus site.
- Add screenshots and usage guides as the public docs mature.

## Branching Strategy & Git Flow

We strictly follow a feature-branching model:

1. Create a branch: `feature/JIRA-123-short-description` or `bugfix/JIRA-456-issue`
2. Commit changes frequently via `npm run format` and `npm run test:watch`.
3. Push to branch. Note: Our `pre-push` Husky hooks will enforce type checking (`npx tsc --noEmit`) and testing thresholds.
4. Open a Pull Request.

## Security & Hooks

- **Pre-commit:** Ensures linting (`eslint --fix`) and formatting (`prettier --write`) run against staged files using `lint-staged`.
- **Pre-push:** Enforces a complete test suite run and strict typescript compilation checks.
- **Headers:** The Next config blocks iframe embedding (`X-Frame-Options`), disables `X-Powered-By`, and enables strict transport payload protections.
