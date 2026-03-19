import { render, screen } from '@testing-library/react';
import Home from '@/app/page';

describe('Home Page', () => {
  it('renders the portal title', () => {
    render(<Home />);

    // Check if the primary title is rendered
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Dashboard'
    );
  });

  it('renders a welcome message', () => {
    render(<Home />);
    expect(
      screen.getByText(
        /Manage your cloud infrastructure and self-service deployments/i
      )
    ).toBeInTheDocument();
  });
});
