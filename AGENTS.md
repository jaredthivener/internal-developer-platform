---
description: Global instructions for developing the Internal Developer Portal (IDP)
applyTo: ['**/*']
---

# IDP Workspace Instructions

Welcome to the Internal Developer Portal (IDP) workspace! This repository is an enterprise-grade platform engineering portal abstracting Day 2 Kubernetes operations via Crossplane.

## 🏗 Tech Stack & Architecture

- **Framework:** Next.js 16 (App Router) + React 19
- **Styling:** Material UI (MUI v7) with `@emotion/*`. **Do not use Tailwind CSS.**
- **Authentication:** NextAuth.js (Entra ID / Azure AD)
- **Infrastructure Engine:** Crossplane via `@kubernetes/client-node`
- **Testing:** Vitest, React Testing Library, Jest-DOM (Test-Driven Development required!)
- **Directory Structure:** All implementation lives inside `src/`.
  - `src/components/{ui,layout,forms}`: Reusable MUI components.
  - `src/features`: Domain-specific business logic (e.g., `clusters`, `vulnerabilities`).
  - `src/lib`: Integrations like `auth` and `crossplane`.
  - `src/app`: Next.js App Router endpoints and page layouts.

## 🛠 Commands (Agents should use these automatically)

- **Install:** `npm install`
- **Build:** `npm run build`
- **Test:** `npm run test` (Vitest run)
- **Test (Watch):** `npm run test:watch`
- **Format:** `npm run format` (Prettier)
- **Lint:** `npm run lint`
- **Typecheck:** `npx tsc --noEmit`

## 📋 Best Practices & Conventions

1. **Test-Driven Methodology:** Write or update tests in `src/__tests__/` BEFORE implementing features. Avoid bugs entering the repo.
2. **Strict TypeScript:** Avoid `any` or `@ts-ignore`. Explicitly type all functional components and API responses.
3. **App Router Conventions:** Server Components by default. Use `"use client";` ONLY at the leaf nodes (for interactivity/MUI hooks).
4. **Git Flow:** The project uses Husky (`pre-commit` for formatting/linting, `pre-push` for tests/types). Ensure code compiles and passes tests before suggesting commits.

## ⚠️ Potential Pitfalls

<!-- BEGIN:nextjs-agent-rules -->

- **Next.js 16:** This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
- **Material UI with Next.js App Router:** Ensure `<ThemeProvider>` and `<CssBaseline>` are within a `"use client"` Provider component (like `src/app/Providers.tsx`), not directly in the server-rendered `layout.tsx`.
- **Crossplane Comm:** Never shell out (no `kubectl` commands in code). Always use the Kubernetes custom object API (`patchNamespacedCustomObject`) inside the Next.js API routes (`src/app/api/...`).

## 🔑 Key Files

- `src/app/layout.tsx` - Main entry and provider wrapper.
- `src/app/Providers.tsx` - Client-side theme and NextAuth session context.
- `src/lib/auth/authOptions.ts` - Entra ID configuration.
- `vitest.config.ts` & `package.json` - Core configuration and scripts.
