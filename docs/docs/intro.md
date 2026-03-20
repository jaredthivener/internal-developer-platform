---
sidebar_position: 1
---

# Overview

The Internal Developer Portal provides a curated application platform experience on top of Kubernetes and Crossplane.

These docs are for developers using the IDP, not for Docusaurus itself.

## What Developers Should Expect

- A portal that presents application environments instead of raw infrastructure resources.
- Self-service workflows for requesting or managing platform-backed capabilities.
- Clearer terminology around compute, networking, storage, and databases.
- A guided path from catalog entry, to request workflow, to operational follow-up.

## What This Repo Contains

- A Next.js 16 application for the primary portal UI.
- Material UI based application workflows and layout primitives.
- API routes that broker platform interactions.
- A public Docusaurus documentation site in the nested `docs` workspace.

## What Is Implemented Today

- A dedicated `Catalog` experience for platform-backed offerings.
- An `Azure Storage` catalog entry with a governed storage account workflow.
- A `Resources` inventory for reviewing provisioned storage accounts.
- A resource detail view for inspecting status and starting deletion.
- Offline development mode so UI work can continue without a live cluster.

## Product Direction

The current UX direction is to present infrastructure as application environments instead of exposing raw platform building blocks. The goal is that a developer sees a cohesive view of components such as compute, networking, storage, and databases, rather than needing to understand Crossplane internals.

## Current State

- Toggleable light and dark themes are supported in the main portal.
- Local development includes mocked API fallbacks so the UI can be refined without a live cluster.
- Tests are in place for core UI and API flows.
- The main end-to-end productized workflow today is Azure Storage account provisioning through the catalog.

## Next Steps

- Continue abstracting infrastructure terminology behind application-focused workflows.
- Expand public documentation around architecture, operations, and onboarding.
- Add deployment guidance and environment diagrams.

See [using the IDP](./using-the-idp.md), [azure storage workflow](./storage-account-workflow.md), [architecture](./architecture.md), [local development](./local-development.md), and [roadmap](./roadmap.md) for the next level of detail.
