---
sidebar_position: 2
---

# Architecture

## Application Layer

The main product is a Next.js 16 application using the App Router. The UI is built with Material UI and uses a console-style layout intended to feel closer to a cloud platform control plane than a generic CRUD dashboard.

## Experience Layer

The current user-facing direction is application-centric. Instead of exposing infrastructure objects directly, the portal is moving toward a model where a developer sees an environment composed of capabilities such as:

- Compute
- Networking
- Storage
- Databases
- Operational status

This avoids requiring every user to understand Crossplane resource vocabulary.

## Platform Layer

Behind the UI, platform interactions are brokered through API routes. Those routes use the Kubernetes client to communicate with Crossplane-managed resources and custom objects.

## Development Mode

For local UI iteration, API routes can return mocked development responses when the backing cluster is unavailable. That keeps product work moving even when a Kubernetes environment is offline.

## Documentation Layer

Public-facing documentation is served separately through Docusaurus in the nested `docs` workspace and deployed to GitHub Pages.
