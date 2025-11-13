import { render, screen, waitFor } from '@testing-library/react';
import HealthPage from '../page';

// Mock fetch
global.fetch = jest.fn();

describe('Health Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should display loading state initially', () => {
    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<HealthPage />);

    expect(screen.getByText(/Checking.../i)).toBeInTheDocument();
  });

  it('should display "API status: ok" when API responds with 200', async () => {
    const mockHealthData = {
      status: 'ok',
      service: 'ACK Thiboro SACCO API',
      timestamp: '2025-11-13T10:00:00.000Z',
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockHealthData,
    });

    render(<HealthPage />);

    // Wait for the API status to be displayed
    await waitFor(() => {
      expect(screen.getByText('API status: ok')).toBeInTheDocument();
    });

    // Verify the green badge is shown (success state)
    const badge = screen.getByText('API status: ok');
    expect(badge).toHaveClass('bg-green-100', 'text-green-800');
  });

  it('should display health data details when API responds successfully', async () => {
    const mockHealthData = {
      status: 'ok',
      service: 'ACK Thiboro SACCO API',
      timestamp: '2025-11-13T10:00:00.000Z',
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockHealthData,
    });

    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('ACK Thiboro SACCO API')).toBeInTheDocument();
    });

    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('should display "API status: error" when API returns non-200 status', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('API status: error')).toBeInTheDocument();
    });

    // Verify the red badge is shown (error state)
    const badge = screen.getByText('API status: error');
    expect(badge).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('should display error message when API connection fails', async () => {
    const errorMessage = 'Failed to connect to API';
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('API status: error')).toBeInTheDocument();
    });

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('should call correct API endpoint', async () => {
    const mockHealthData = {
      status: 'ok',
      service: 'ACK Thiboro SACCO API',
      timestamp: '2025-11-13T10:00:00.000Z',
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockHealthData,
    });

    render(<HealthPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/v1/health',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });
  });

  it('should have refresh and sign-in buttons', () => {
    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {})
    );

    render(<HealthPage />);

    expect(screen.getByText('Refresh Status')).toBeInTheDocument();
    expect(screen.getByText('Go to Sign In')).toBeInTheDocument();
  });
});
