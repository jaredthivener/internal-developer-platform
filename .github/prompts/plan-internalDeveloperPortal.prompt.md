## Plan: Internal Developer Portal MVP

The Internal Developer Portal (IDP) will provide a unified Next.js + React + Material UI interface for managing Kubernetes clusters and platform infrastructure. It will focus on robust DevSecOps practices, enabling developers to perform Day 2 operations securely and providing automated lifecycle management and security enforcement.

**Steps**

**Phase 1: Foundation & Scaffolding**
1. Initialize the project with Next.js (App Router), React, and Material UI (MUI v6).
2. Configure ESLint, Prettier, and strict TypeScript settings.
3. Setup testing infrastructure (Vitest, React Testing Library, Playwright for E2E) to align with test-driven methodology (*depends on step 1*).
4. Implement Authentication and RBAC using Entra ID (Azure AD).

**Phase 2: Infrastructure State & Security Posture**
5. Connect to the Infrastructure as Code (IaC) Engine (Terraform/Crossplane) to fetch infrastructure state.
6. Integrate with security scanning tools (e.g., Trivy, Snyk) to surface unpatched vulnerabilities (*parallel with step 5*).
7. Build the UI dashboards (Cluster Overview, Security Posture, Workload Health, Cost Dashboard & Downscaling Insights).

**Phase 3: Day 2 Operations Automation**
8. Design the "Update Engine" backend workflow to trigger IaC state changes for Day 2 operations (*depends on Phase 1 & 2*).
9. Implement secure IaC workflows to push configuration drift remediation, K8s patching, and infrastructure upgrades.
10. Build the interactive Day 2 Operations UI (Workload rollbacks/restarts, Configuration updates, Cluster upgrades).

**Relevant files**
- `/package.json` — Project dependencies (Next.js, React, @mui/material, Authentication SDKs).
- `/src/app/` — Next.js App Router for layout, pages, and API definitions.
- `/src/lib/iac/` — Terraform/Crossplane state interaction utilities.
- `/src/lib/auth/` — Entra ID RBAC integration and OAuth flows.
- `/tests/` — Comprehensive TDD suites.

**Verification**
1. Verify Next.js scaffold compiles correctly, and tests run successfully before implementing features.
2. Confirm Entra ID authentication flow completes seamlessly.
3. Stub IaC engine responses to validate test coverage thresholds for all new backend integrations.
4. Run comprehensive manual and E2E tests for Day 2 operation triggers securely updating IaC states.

**Decisions**
- Tech Stack: Next.js (latest), React (latest), Material UI (latest).
- Execution Abstraction: Infrastructure as Code (IaC) via API/state files.
- Authentication: Microsoft Entra ID.
- Scope: Deep K8s upgrades, config drift, cost optimization, vulnerabilities, and rollbacks.
- Testing Strategy: TDD required for all implementations.

**Further Considerations**
1. Which specific IaC engine APIs (e.g., Terraform Enterprise/Cloud, Crossplane control plane, Pulumi Cloud) will the portal invoke?
2. Which vulnerability scanning platform (Trivy, Snyk, Prisma) exposes APIs for our dashboard integration?
