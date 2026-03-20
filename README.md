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

Use the AKS bootstrap script to stand up a low-cost Azure control-plane environment for the IDP and Crossplane:

```bash
bash scripts/azure/bootstrap-aks-control-plane.sh
```

What the script does:

- Creates a resource group in a supported AKS Automatic region.
- Creates a service principal intended for Crossplane or platform automation credentials.
- Assigns scoped RBAC roles for resource provisioning and AKS access.
- Creates an AKS Automatic cluster pinned to Kubernetes `1.34` with hosted system pools, OIDC issuer, and workload identity enabled.
- Adds a low-cost Arm64 Spot user node pool for non-critical workloads.
- Writes a Crossplane-ready service principal credentials file to `.azure/<cluster-name>-crossplane.json` by default.

Important:

- The bootstrap defaults to Kubernetes `1.34` because `@kubernetes/client-node` in this platform supports the Kubernetes `1.34` minor line. If an existing cluster is already on a different minor version, the bootstrap script will now fail fast instead of silently proceeding.
- AKS itself uses managed identity. The generated service principal is for Crossplane or other platform automation, not the cluster identity.
- Managed system capacity remains on the hosted automatic/system side. The Arm64 Spot pool is for cheaper workload scheduling and should not be the only capacity for critical recovery paths.
- AKS Automatic hosted system node pools are currently preview and region-limited. The script validates the Azure CLI prereqs and preview feature registration before cluster creation.

## AKS Deployment

After the cluster exists, deploy Crossplane and the IDP app with:

```bash
bash scripts/azure/deploy-platform-to-aks.sh
```

What the deploy script does:

- Reuses an existing ACR from the target resource group when one already exists, otherwise creates a new Basic ACR and attaches it to the AKS cluster.
- Builds the Next.js app as a standalone container image and pushes it to ACR.
- Installs Crossplane with Helm into `crossplane-system`.
- Installs the Azure provider family packages needed for resource groups, networking, storage, PostgreSQL, and AKS.
- Creates the Azure provider secret from the bootstrap-generated service principal JSON file.
- Applies a cluster-scoped Crossplane `ClusterProviderConfig` and a smoke-test `ResourceGroup` example.
- Creates the `idp-system` namespace resources and deploys the app.
- Creates or updates a public `Ingress` using the AKS web app routing ingress class and derives a default public hostname from the ingress load balancer IP when one is not provided.

Important deploy behavior:

- If `ACR_NAME` is unset and the resource group already contains exactly one Azure Container Registry, the script reuses that registry for subsequent runs.
- If `ACR_NAME` is unset and the resource group contains no registries, the script creates a new one.
- If `ACR_NAME` is unset and the resource group contains multiple registries, the script fails fast and requires an explicit `ACR_NAME`.
- If `INGRESS_HOST` is unset, the deploy script derives `idp.<ingress-public-ip>.sslip.io` from the existing AKS web app routing load balancer service.
- If `NEXTAUTH_EXTERNAL_URL` is unset, the deploy script sets `NEXTAUTH_URL` in the cluster secret to `http://<ingress-host>` for the public deployment.

For a manifest-level explanation of how the service, deployment, and ingress work together, see [platform/kubernetes/idp/README.md](./platform/kubernetes/idp/README.md).

Starter assumptions:

- The script expects a real app env file at `.env.local` by default.
- For an initial cluster-local setup, keep `NEXTAUTH_URL=http://localhost:3000` and access the app with `kubectl -n idp-system port-forward svc/idp-web 3000:80`.
- The shipped starter RBAC for the app is read-only against Crossplane and Azure managed resources. If you re-enable write flows in the UI, expand the service account permissions deliberately instead of broadening them blindly.

## Storage Account Dev Workflow

After the AKS platform deploy completes:

1. Port-forward the app:

```bash
kubectl -n idp-system port-forward svc/idp-web 3000:80
```

2. Open the portal at `http://localhost:3000`.
3. Use the `Azure Storage Account Workflow` form in the Azure resource catalog.
4. Submit a dev-safe request targeting the default smoke-test resource group `idp-crossplane-smoke`, or another existing resource group that Crossplane can write to.

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
