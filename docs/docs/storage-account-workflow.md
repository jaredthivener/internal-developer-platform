---
sidebar_position: 3
---

# Azure Storage Workflow

## Why This Workflow Exists

The Azure Storage account workflow is the clearest example of the portal's current product direction: developers should be able to request a governed platform capability without having to author Kubernetes manifests or understand raw Crossplane resource schemas.

This workflow turns an Azure storage request into a guided product flow:

1. discover the offering in the catalog,
2. submit a request with approved defaults and guardrails,
3. review the provisioned result in the resources inventory,
4. inspect lifecycle state in a resource details page,
5. start deletion from the same portal experience.

## Who Should Read This

- Product and platform engineers extending the IDP UX.
- Application developers learning how to request storage through the portal.
- Contributors validating the current Crossplane-backed workflow end to end.

## Current User Journey

The implemented flow spans these routes:

- `/catalog`
- `/catalog/azure-storage`
- `/resources`
- `/resources/[name]`

In practical terms, the journey looks like this:

1. Open the `Catalog` page.
2. Choose `Azure Storage`.
3. Complete the guided form.
4. Submit the request.
5. Move to `Resources` to inspect what exists.
6. Open a specific storage account for details or deletion.

## What The Form Does

The Azure Storage workflow is intentionally more than a thin wrapper around a YAML template.

It currently does all of the following:

- Loads approved resource groups from Crossplane-managed `resourcegroups`.
- Filters to resource groups whose `Ready` condition is `True`.
- Applies a default location of `westus3`.
- Supports multiple storage account kinds, tiers, replication modes, and advanced settings.
- Enforces Azure-specific rules such as premium-only account kinds.
- Hides or resets fields when a selected account kind does not support them.
- Submits a Crossplane managed resource through the shared resource API.

The managed resource being created is:

```yaml
apiVersion: storage.azure.upbound.io/v1beta1
kind: Account
```

## What Developers See Versus What The Platform Sees

From the developer point of view, the experience is:

- choose an offering,
- fill in a guided request,
- review lifecycle state.

From the platform point of view, the workflow ultimately creates and manages a Crossplane resource backed by the Azure provider.

That split is important. The portal should educate developers about platform behavior without forcing them to think in raw provider CRDs during ordinary use.

## Local Development Modes

### Offline UI Mode

Use this for most day-to-day product work:

```bash
npm install
cp .env.example .env.local
npm run dev:local
```

This mode enables the offline Crossplane mock path.

That means you can still:

- open the catalog,
- render the Azure Storage workflow,
- submit the form,
- navigate to resources,
- open a resource details view,
- exercise delete flows.

What you are not validating in this mode:

- real cluster reads,
- approved resource group reconciliation,
- provider configuration,
- actual Azure storage creation.

### Live Cluster Mode

Use this when you need to verify the full platform path:

```bash
npm run dev
```

In this mode, the portal expects a working Kubernetes context and a Crossplane-enabled environment.

Live-cluster validation is the right choice when you need to confirm:

- approved resource groups are discovered correctly,
- create and delete requests reach the cluster,
- Crossplane reconciliation behaves as expected,
- Azure provider permissions and configuration are correct.

## Recommended End-To-End Validation Path

When you want to educate a developer or verify the intended workflow, use this path.

### 1. Confirm platform prerequisites

Make sure the environment has:

- a reachable Kubernetes cluster,
- Crossplane installed,
- Azure provider configuration applied,
- at least one ready resource group that the storage workflow can target.

### 2. Open the portal

Either run locally or use the deployed AKS-hosted portal.

### 3. Create a storage account from the catalog

On `/catalog/azure-storage`:

- choose an approved resource group,
- keep the default safe settings if you are smoke testing,
- optionally expand advanced settings to validate form guardrails,
- submit the request.

### 4. Inspect the resources inventory

Open `/resources` and confirm the new storage account appears with a lifecycle label such as `Ready` or `Pending`.

### 5. Inspect resource details

Open `/resources/<name>` and verify:

- resource group,
- location,
- account tier,
- replication mode,
- access tier,
- public network setting,
- Azure resource ID when available.

### 6. Exercise deletion carefully

Use the resource details view to start deletion.

This validates that the portal can move from request creation into lifecycle operations instead of stopping at a one-way form submission.

## Cluster-Side Smoke Test

If you need to compare the portal behavior with direct cluster input, you can apply the example manifest from the repository root:

```bash
sed \
  -e "s/STORAGE_ACCOUNT_NAME_PLACEHOLDER/devstorealpha01/" \
  -e "s/RESOURCE_GROUP_PLACEHOLDER/idp-crossplane-smoke/" \
  -e "s/LOCATION_PLACEHOLDER/westus3/" \
  platform/crossplane/examples/storage-account-dev.yaml | kubectl apply -f -
```

Then inspect the resulting resource:

```bash
kubectl get accounts.storage.azure.upbound.io
kubectl describe account.storage.azure.upbound.io/devstorealpha01
```

This is useful for understanding the platform behavior, but it is not the preferred everyday consumer path. The portal workflow is the product surface we want developers to adopt.

## Files Contributors Should Know

If you are extending this workflow, these files are the main touchpoints:

- `src/app/catalog/azure-storage/page.tsx`
- `src/components/features/catalog/AzureStorageAccountWorkflow.tsx`
- `src/app/resources/page.tsx`
- `src/components/features/resources/StorageAccountResourceList.tsx`
- `src/components/features/resources/StorageAccountResourceDetails.tsx`
- `src/app/api/crossplane/resources/route.ts`
- `platform/crossplane/examples/storage-account-dev.yaml`

## Common Development Guidance

- Use offline mode first for UI and workflow iteration.
- Switch to a live cluster only when you need real reconciliation evidence.
- Keep the portal language product-oriented even when the implementation relies on Crossplane.
- Add or update tests before changing workflow behavior.
- Treat the storage workflow as the reference pattern for future catalog-backed capabilities.

## What This Workflow Teaches The Team

This feature is not just about Azure Storage.

It demonstrates the broader IDP pattern:

- product-oriented catalog entry,
- guided request form,
- platform API mediation,
- resources inventory,
- operational detail view,
- lifecycle controls.

Future workflows for databases, networking, or compute should feel consistent with this shape even when the underlying resource model differs.
