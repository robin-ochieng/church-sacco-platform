import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignInPage from '../page';

describe('Sign In Page', () => {
  it('should render sign in form', () => {
    render(<SignInPage />);

    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should update email and password inputs', () => {
    render(<SignInPage />);

    const emailInput = screen.getByPlaceholderText('Email address') as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText('Password') as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    expect(emailInput.value).toBe('test@example.com');
    expect(passwordInput.value).toBe('password123');
  });

  it('should show loading state when submitting', async () => {
    render(<SignInPage />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    const emailInput = screen.getByPlaceholderText('Email address');
    const passwordInput = screen.getByPlaceholderText('Password');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
    });
  });

  it('should have link to health check page', () => {
    render(<SignInPage />);

    const healthLink = screen.getByText('Check API Health Status');
    expect(healthLink).toBeInTheDocument();
    expect(healthLink).toHaveAttribute('href', '/health');
  });

  it('should disable inputs while loading', async () => {
    render(<SignInPage />);

    const emailInput = screen.getByPlaceholderText('Email address') as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText('Password') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(submitButton).toBeDisabled();
    });
  });
});
