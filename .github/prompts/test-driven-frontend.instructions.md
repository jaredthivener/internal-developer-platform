---
description: Enforces Test-Driven Development (TDD) for frontend components using React Testing Library and Vitest.
applyTo:
  - 'src/components/**/*'
  - 'src/app/**/*'
  - 'src/features/**/*'
---

# Test-Driven Frontend Development

When modifying or creating new React components in this project, you must adhere strictly to a Test-Driven Development (TDD) workflow.

## The Workflow

1. **Write the Test First:** Always create or update the corresponding `.test.tsx` file inside the `src/__tests__/` directory (or adjacent to the component if preferred by standard) _before_ implementing the component logic.
2. **Focus on Accessibility:** Use `getByRole`, `getByLabelText`, and `getByText` rather than test IDs or CSS selectors.
3. **Simulate Real User Behavior:** Import and use `@testing-library/user-event` for all interaction testing (clicks, typing, keyboard navigation) instead of `fireEvent`.
4. **Implementation:** Only write the minimum React and Material UI (v7) code required to pass the newly written tests.

## Anti-Patterns (Do NOT do these)

- Do not write the component first and the test second.
- Do not use Tailwind CSS (we strictly use `@mui/material`).
- Do not test implementation details (like asserting internal state variables); test the rendered output and ARIA roles.
