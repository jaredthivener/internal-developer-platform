---
sidebar_position: 2
---

# Using the IDP

## Who These Docs Are For

These docs are written for engineers and developers who consume the Internal Developer Portal to request, inspect, and operate application environments.

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

## What You Should Not Need To Know

The intent is that most developers should not need to understand:

- Crossplane resource naming
- Kubernetes custom resource schemas
- Provider-specific implementation details for common environment requests

Those details still exist in the platform layer, but they should be abstracted away from the primary experience.

## Current Direction

The portal is actively moving toward a single environment view that groups related capabilities together. A future view should let a developer quickly understand an environment as a cohesive system rather than a list of unrelated infrastructure records.
