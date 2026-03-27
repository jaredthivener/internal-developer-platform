import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ButtonLink from '@/components/ui/ButtonLink';

describe('ButtonLink', () => {
  it('renders a navigable link with button styling', () => {
    render(
      <ButtonLink href="/catalog" variant="contained">
        Open Catalog
      </ButtonLink>
    );

    expect(screen.getByRole('link', { name: /open catalog/i })).toHaveAttribute(
      'href',
      '/catalog'
    );
  });

  it('supports additional button props', () => {
    render(
      <ButtonLink
        href="/resources"
        variant="text"
        aria-label="Back to resources"
      >
        Back
      </ButtonLink>
    );

    expect(
      screen.getByRole('link', { name: /back to resources/i })
    ).toHaveAttribute('href', '/resources');
  });
});
