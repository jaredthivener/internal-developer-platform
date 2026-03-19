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
npm run dev
```

The app runs on `http://localhost:3000`.

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
