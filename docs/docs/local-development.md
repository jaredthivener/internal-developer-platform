---
sidebar_position: 3
---

# Local Development

## Prerequisites

- Node.js 20+
- npm 10+
- Access to a Kubernetes cluster with Crossplane for live platform testing

## App Setup

From the repository root:

```bash
npm install
cp .env.example .env.local
npm run dev:local
```

The app runs on `http://localhost:3000`.

Use `npm run dev:local` for the default developer experience. It enables the offline Crossplane mock path so the catalog, Azure Storage workflow, and resources pages render without a live cluster.

If you want to exercise the live Kubernetes and Crossplane integration instead, run:

```bash
npm run dev
```

That mode expects a working cluster context and valid local application configuration.

## Storage Workflow Development

For most feature work, use the offline flow first:

1. Start the app with `npm run dev:local`.
2. Open the catalog and enter the Azure Storage workflow.
3. Validate the form behavior, guardrails, success state, resources inventory, and resource details view.

The offline mode is intended for:

- UI iteration.
- content and workflow design.
- client-side validation behavior.
- route-level API handling in development.

Use a live cluster when you need to validate:

- approved resource group discovery,
- Crossplane reconciliation,
- provider configuration,
- real Azure resource creation,
- delete behavior against the cluster.

See [Azure Storage workflow](./storage-account-workflow.md) for the full end-to-end path.

## Docs Setup

From the repository root:

```bash
npm run docs:dev
```

This starts the Docusaurus site from the nested `docs` workspace.

## Quality Checks

Use the repo-level checks before pushing changes:

```bash
npm run test
npx tsc --noEmit
```

For docs-only changes, also validate the static site build:

```bash
npm run docs:build
```

If you change storage workflow behavior or copy, prefer validating both:

- the relevant Vitest coverage, and
- the Docusaurus static build.
