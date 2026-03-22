---
sidebar_position: 5
---

# Disaster Recovery And Drift Management

## Problem Statement

Today the IDP writes Crossplane managed resources directly to the management AKS cluster. That means the cluster currently acts as both:

- the reconciliation plane,
- and the only durable record of desired infrastructure state.

That is not sufficient for disaster recovery or for drift-aware lifecycle management.

If the management cluster is impaired or destroyed:

- existing Azure resources usually continue to exist,
- Crossplane stops reconciling,
- the current portal loses authoritative desired state for dynamically created resources,
- and the UI cannot reliably distinguish healthy resources from drifted or orphaned resources.

## Target Outcome

The platform should be able to:

1. persist intended resource configuration outside Kubernetes,
2. observe live Azure resource configuration independently of Crossplane availability,
3. classify every managed resource into a small set of actionable states,
4. offer a safe sync-back flow through Crossplane,
5. restore the control plane quickly with Velero,
6. fall back to adoption of existing Azure resources when restored Kubernetes state is incomplete.

## Core Architecture

The recommended control model is:

- Crossplane remains the reconciler.
- The IDP owns durable desired state.
- Azure becomes the cloud-observed truth for drift detection.
- The UI reads from a projection model, not directly from raw Crossplane objects.

### Control Planes

The design separates four concerns.

#### 1. Desired State Store

Persist desired state before the platform writes to the Kubernetes API.

This store should hold:

- workflow request identity,
- desired resource specification,
- ownership metadata,
- Crossplane binding metadata,
- Azure binding metadata,
- remediation and lifecycle history.

#### 2. Crossplane Reconciliation Plane

Crossplane on AKS remains responsible for applying and reconciling Azure resources. It should not remain the only source of truth for what the developer asked for.

#### 3. Azure Observation Plane

Observe Azure independently of cluster health.

For the initial storage-account scope:

- use Azure Resource Graph for broad inventory,
- use targeted ARM reads for detailed field comparison,
- correlate resources using ARM ID and IDP ownership tags.

#### 4. UI Read Model

The UI should read a projection that joins:

- desired state,
- Crossplane state,
- Azure-observed state,
- classification and drift details.

## Classification Model

The first-class platform states are:

- `In sync`
- `Pending`
- `Drifted`
- `Cloud-only`
- `Desired-only`
- `Control plane unavailable`

These states should be computed from three inputs:

- desired state,
- Crossplane state,
- Azure-observed state.

### Recommended Interpretation

- `In sync`: desired state exists, Azure resource exists, owned fields match.
- `Pending`: the resource is provisioning, deleting, or reconciling.
- `Drifted`: Azure differs from desired state on owned fields.
- `Cloud-only`: Azure resource exists but no desired-state record or Crossplane binding exists.
- `Desired-only`: desired state exists but Azure resource does not.
- `Control plane unavailable`: the management cluster or Crossplane API path is unavailable. This is a platform health state and should also be surfaced independently from per-resource drift.

## Owned Fields

Do not compare every Azure field.

For the initial Azure Storage Account scope, compare only the fields the IDP deliberately owns, such as:

- location,
- account kind,
- account tier,
- replication type,
- access tier,
- minimum TLS version,
- public network access,
- blob public access,
- shared access key enablement,
- cross-tenant replication enablement,
- selected platform-owned tags.

Provider-generated fields, timestamps, endpoints, and other computed values should not be treated as drift.

## Sync-Back Strategy

The normal remediation path should be:

1. show the drift delta,
2. create a remediation request,
3. update desired state,
4. patch Crossplane-managed desired state,
5. let Crossplane reconcile Azure.

Direct Azure mutation should not be the standard sync-back mechanism.

This keeps the platform lifecycle coherent and preserves auditability.

## Disaster Recovery Strategy

### Primary Path: Velero Restore

Velero should be treated as the primary restore path for cluster-side desired state.

Back up at minimum:

- `crossplane-system`,
- `idp-system`,
- Crossplane CRDs and related cluster-scoped objects,
- Provider objects,
- `ProviderConfig` and `ClusterProviderConfig`,
- provider secrets,
- dynamically created managed resources,
- connection secrets.

Restore order should be:

1. rebuild AKS,
2. reinstall Crossplane and providers,
3. restore provider secrets and configs,
4. restore Crossplane runtime objects,
5. restore dynamic managed resources,
6. restore the IDP application.

### Fallback Path: Adopt Existing Azure Resources

If dynamic Crossplane objects are missing after disaster:

1. rebuild AKS,
2. reinstall Crossplane and providers,
3. restore provider auth,
4. rediscover Azure resources,
5. recreate managed resources in observe-only mode,
6. validate identity and status,
7. promote to normal management.

This is slower and more operationally expensive than a Velero restore, so it should remain the fallback, not the primary plan.

## Required Metadata

For each provisioned resource, the IDP should preserve enough metadata to restore or adopt it safely:

- request ID,
- workflow type,
- desired specification,
- Crossplane `apiVersion`, `kind`, and object name,
- external-name annotation where relevant,
- provider-config reference,
- Azure ARM ID,
- subscription ID,
- resource group,
- location,
- ownership metadata,
- remediation history.

The platform should also tag Azure resources with IDP ownership metadata so `Cloud-only` resources can be detected safely.

## Current Milestone 1 Runtime Configuration

The first implementation slice adds durable submission persistence before the platform writes to Kubernetes.

The current runtime supports two persistence adapters:

- Azure Blob Storage when both of these environment variables are configured:
  - `IDP_DESIRED_STATE_AZURE_BLOB_ACCOUNT_URL`
  - `IDP_DESIRED_STATE_AZURE_BLOB_CONTAINER`
- Filesystem fallback when Blob configuration is not present.

The filesystem fallback is useful for local development and test execution. It should not be treated as the long-term production source of truth.

An optional filesystem path override is also supported:

- `IDP_DESIRED_STATE_FILESYSTEM_PATH`

## Workstreams

The implementation is split into six workstreams.

1. Source of truth
2. Submission pipeline
3. Azure observation
4. Classification engine
5. Sync-back remediation
6. UI read model and health

### Recommended Order

1. add durable desired-state storage,
2. persist workflow intent before Crossplane apply,
3. add Azure observation for storage accounts,
4. compute classification and drift,
5. expose status in the UI,
6. add sync-back,
7. validate Velero restore and adoption fallback.

## Initial Scope

The first implementation slice should cover only Azure Storage Accounts because the repository already has:

- a storage workflow,
- a storage resource list,
- a storage resource details page,
- a direct Crossplane API integration for that resource type.

That first slice should deliver:

- durable desired-state persistence,
- Azure live-state observation,
- drift classification,
- drift details in the UI,
- sync-back through Crossplane.

## Milestone Baseline

### Milestone 1: Durable Intent

- desired state is stored before Kubernetes apply,
- resource requests have stable IDs,
- Crossplane and Azure binding metadata are preserved.

### Milestone 2: Cloud Observation

- Azure storage accounts are observable from the platform,
- list and detail views can show Azure-backed status,
- orphaned cloud resources can be surfaced.

### Milestone 3: Drift Classification

- the platform can classify storage accounts correctly,
- the UI can show field-level drift.

### Milestone 4: Safe Remediation

- users can request sync-back,
- sync-back routes through Crossplane,
- remediation is blocked or queued when the control plane is unavailable.

### Milestone 5: DR Readiness

- Velero covers the required Crossplane and IDP state,
- restore order is documented and validated,
- adoption fallback is documented for partial recovery.

## Current Recommendation

For this repository, the practical next move is:

1. implement durable desired-state persistence,
2. implement Azure observation for storage accounts,
3. document and validate Velero restore scope,
4. then build classification and sync-back on top of those foundations.
