---
sidebar_position: 2
---

# Using the IDP

## Who These Docs Are For

These docs are written for engineers and developers who consume the Internal Developer Portal to request, inspect, and operate application environments.

## What A Developer Can Do Today

The current productized path is centered on a governed Azure Storage lifecycle:

- Open the platform catalog.
- Choose the Azure Storage offering.
- Submit a guided storage account request.
- Review the provisioned result in the resources inventory.
- Open a resource details page for inspection or deletion.

## Core Mental Model

The product direction is to hide raw platform implementation details wherever possible. Instead of asking developers to reason about Crossplane compositions and managed resources, the portal should describe a deployable environment in terms that match how teams work:

- Compute
- Networking
- Storage
- Databases
- Health and operations

## What You Will Use the Portal For

- View the current state of an application environment.
- Request platform-backed resources through guided workflows.
- Understand environment health without digging through Kubernetes APIs.
- Access a more product-like control plane instead of an infrastructure operator console.

## Current Navigation Model

The console is now organized around a few main surfaces:

- `Applications`: product and ownership context.
- `Catalog`: available self-service platform workflows.
- `Resources`: provisioned inventory and operational actions.
- `Settings`: platform guardrails and operating assumptions.

For the current storage workflow, the typical path is:

1. Open `Catalog`.
2. Select `Azure Storage`.
3. Complete the storage account workflow.
4. Open `Resources` to review reconciliation and ongoing state.
5. Open a specific resource for detail inspection or deletion.

## What You Should Not Need To Know

The intent is that most developers should not need to understand:

- Crossplane resource naming
- Kubernetes custom resource schemas
- Provider-specific implementation details for common environment requests

Those details still exist in the platform layer, but they should be abstracted away from the primary experience.

## Azure Storage Workflow In Practice

The Azure Storage workflow is designed to teach the product model:

- The developer sees approved resource groups instead of arbitrary subscription sprawl.
- The form enforces practical Azure storage constraints, such as premium-only account kinds.
- The request is translated into a Crossplane managed resource behind the scenes.
- The resource inventory and detail screens stay focused on lifecycle and status, not raw Kubernetes YAML.

Use the dedicated [Azure Storage workflow guide](./storage-account-workflow.md) for the full request, review, and troubleshooting path.

## Current Direction

The portal is actively moving toward a single environment view that groups related capabilities together. A future view should let a developer quickly understand an environment as a cohesive system rather than a list of unrelated infrastructure records.
