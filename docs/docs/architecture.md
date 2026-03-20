---
sidebar_position: 2
---

# Architecture

## Application Layer

The main product is a Next.js 16 application using the App Router. The UI is built with Material UI and uses a console-style layout intended to feel closer to a cloud platform control plane than a generic CRUD dashboard.

The current route model includes:

- `/` for the platform landing experience.
- `/applications` for application-level context.
- `/catalog` for self-service offerings.
- `/catalog/azure-storage` for the storage account workflow.
- `/resources` for provisioned inventory.
- `/resources/[name]` for resource inspection and deletion.

## Experience Layer

The current user-facing direction is application-centric. Instead of exposing infrastructure objects directly, the portal is moving toward a model where a developer sees an environment composed of capabilities such as:

- Compute
- Networking
- Storage
- Databases
- Operational status

This avoids requiring every user to understand Crossplane resource vocabulary.

Today, that direction is embodied most concretely in the Azure Storage workflow, where platform rules and provider constraints are expressed through a guided form rather than through direct YAML authoring.

## Platform Layer

Behind the UI, platform interactions are brokered through API routes. Those routes use the Kubernetes client to communicate with Crossplane-managed resources and custom objects.

The main storage lifecycle runs through the generic Crossplane resource route:

- `GET /api/crossplane/resources` for inventory and single-resource reads.
- `POST /api/crossplane/resources` for managed resource creation.
- `DELETE /api/crossplane/resources` for deletion.

The Azure Storage workflow submits a `storage.azure.upbound.io/v1beta1` `Account` object through that API layer.

## Development Mode

For local UI iteration, API routes can return mocked development responses when the backing cluster is unavailable. That keeps product work moving even when a Kubernetes environment is offline.

In development mode, the resource API can:

- return an empty resource list,
- return a synthetic storage account record for detail pages,
- accept create requests and return a generated fake name,
- accept delete requests without requiring cluster access.

This allows most product work on catalog, resources, and details flows to proceed without blocking on AKS or Crossplane availability.

## Kubernetes And Deployment Layer

The repository also includes Kubernetes manifests and Azure deployment scripts that support a live AKS-based environment:

- Crossplane installation and provider configuration.
- IDP application deployment manifests.
- Internet-facing ingress configuration for the hosted portal.
- Example Crossplane manifests for smoke testing, including Azure Storage.

## Documentation Layer

Public-facing documentation is served separately through Docusaurus in the nested `docs` workspace and deployed to GitHub Pages.
