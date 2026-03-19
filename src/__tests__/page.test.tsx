import { render, screen } from '@testing-library/react';
import Home from '@/app/page';

describe('Home Page', () => {
  it('renders the portal title', () => {
    render(<Home />);
    
    // Check if the primary title is rendered
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Internal Developer Portal');
  });

  it('renders a welcome message', () => {
    render(<Home />);
    expect(screen.getByText(/Platform engineering and Day 2 operations/i)).toBeInTheDocument();
  });
});
