# Internal Developer Portal (IDP) 🚀

A highly opinionated, secure, and developer-friendly IDP built with Next.js, React, Material UI, and Entra ID. This portal is designed to abstract Day 2 Kubernetes operations via a tightly coupled Crossplane IaC engine, empowering developers to self-serve infrastructure and deploy with confidence.

## 🏗 Architecture & Stack

- **Frontend / Backend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Material UI (v6) with custom dark mode theme
- **Authentication**: Microsoft Entra ID (NextAuth.js) with RBAC
- **Infrastructure Engine**: Crossplane (via standard Kubernetes API interaction `@kubernetes/client-node`)
- **Testing**: Vitest, React Testing Library, custom Jest-DOM assertions. TDD enforced.
- **Code Quality**: Prettier, ESLint, Husky (Git Hooks)

## 🔑 Key Features

- **Cluster Insights:** Visualize cluster health, unpatched vulnerabilities (Trivy/Snyk integration), and drift.
- **Day 2 Automation:** Abstracted interactions to execute K8s version upgrades, component patches, and workload rollbacks directly mutating Crossplane Claims (`Composite Resource Definitions`).
- **Enterprise Security:** Enforced Security Headers, restricted permissions-policy, and deep Entra ID RBAC token analysis.

## 🚀 Getting Started (Local Development)

### 1. Prerequisites

- Node.js (v20+)
- `npm` (v10+)
- Access to a local or remote Kubernetes Cluster with Crossplane installed.

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

## 🛠 Branching Strategy & Git Flow

We strictly follow a feature-branching model:

1. Create a branch: `feature/JIRA-123-short-description` or `bugfix/JIRA-456-issue`
2. Commit changes frequently via `npm run format` and `npm run test:watch`.
3. Push to branch. Note: Our `pre-push` Husky hooks will enforce type checking (`npx tsc --noEmit`) and testing thresholds.
4. Open a Pull Request.

## 🛡 Security & Hooks

- **Pre-commit:** Ensures linting (`eslint --fix`) and formatting (`prettier --write`) run against staged files using `lint-staged`.
- **Pre-push:** Enforces a complete test suite run and strict typescript compilation checks.
- **Headers:** The Next config blocks iframe embedding (`X-Frame-Options`), disables `X-Powered-By`, and enables strict transport payload protections.
