import { render, screen } from '@testing-library/react';
import AuthCallbackPage from '../page';

// Mock setTimeout
jest.useFakeTimers();

describe('Auth Callback Page', () => {
  beforeEach(() => {
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should render loading state initially', () => {
    render(<AuthCallbackPage />);

    expect(screen.getByText('Authenticating...')).toBeInTheDocument();
    expect(screen.getByText('Please wait while we sign you in.')).toBeInTheDocument();
  });

  it('should display loading spinner', () => {
    render(<AuthCallbackPage />);

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});
