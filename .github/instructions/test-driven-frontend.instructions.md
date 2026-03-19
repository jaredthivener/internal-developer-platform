---
description: TDD rules for UI component development.
applyTo: ['src/components/**/*.tsx']
---

### Test-Driven Frontend (MUI v7)

When asked to generate or modify a component within `src/components/`:

1. **Test First:** If a file does not have a corresponding `.test.tsx` file inside `src/__tests__/components/`, you MUST create the test file first.
2. **Behavior Over Implementation:** Use `@testing-library/react`. Assert using accessible roles (`getByRole`, `findByRole`) rather than `testing-ids` or text when possible.
3. **MUI v7 Conventions:** Handle Next.js App Router `"use client"` directives appropriately. Ensure you are importing correctly from `@mui/material`.
4. **User Events:** Test interaction by mocking user events with `@testing-library/user-event`.
