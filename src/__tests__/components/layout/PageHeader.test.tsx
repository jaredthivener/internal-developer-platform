import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PageHeader from '@/components/layout/PageHeader';
import ButtonLink from '@/components/ui/ButtonLink';

describe('PageHeader', () => {
  it('renders the title, description, and optional supporting content', () => {
    render(
      <PageHeader
        eyebrow="Resource operations"
        title="Resource Details"
        description="Inspect runtime health and compare desired and observed configuration."
        action={
          <ButtonLink href="/resources" variant="text">
            Back to resources
          </ButtonLink>
        }
      />
    );

    expect(screen.getByText('Resource operations')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Resource Details'
    );
    expect(
      screen.getByText(
        /inspect runtime health and compare desired and observed configuration/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /back to resources/i })
    ).toHaveAttribute('href', '/resources');
  });

  it('omits optional sections when they are not provided', () => {
    render(
      <PageHeader
        title="Catalog"
        description="Choose a platform resource and open a workflow."
      />
    );

    expect(screen.queryByText('Resource operations')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Catalog'
    );
  });
});
