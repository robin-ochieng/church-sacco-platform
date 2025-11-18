import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import RegisterPage from '../page';
import * as membersApi from '@/lib/api/members';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(() => ({
    get: jest.fn(),
  })),
}));

// Mock API
jest.mock('@/lib/api/members', () => ({
  registerMember: jest.fn(),
  checkMemberExists: jest.fn(),
}));

describe('Member Registration Wizard', () => {
  const mockPush = jest.fn();
  const mockRegisterMember = membersApi.registerMember as jest.MockedFunction<typeof membersApi.registerMember>;

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
  });

  describe('Step 1 - Personal Information', () => {
    it('should render personal info step on initial load', () => {
      render(<RegisterPage />);
      
      expect(screen.getByText('Personal Info')).toBeInTheDocument();
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/telephone/i)).toBeInTheDocument();
    });

    it('should validate required fields on step 1', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/first name must be at least 2 characters/i)).toBeInTheDocument();
        expect(screen.getByText(/last name must be at least 2 characters/i)).toBeInTheDocument();
      });
    });

    it('should validate E.164 phone format', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const phoneInput = screen.getByLabelText(/telephone/i);
      await user.type(phoneInput, '0712345678');

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/phone must be in format \+254/i)).toBeInTheDocument();
      });
    });

    it('should validate minimum age requirement (18 years)', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const today = new Date();
      const recentDate = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());
      const dobInput = screen.getByLabelText(/date of birth/i);
      
      await user.type(dobInput, recentDate.toISOString().split('T')[0]);

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/you must be at least 18 years old/i)).toBeInTheDocument();
      });
    });

    it('should proceed to step 2 with valid data', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      // Fill out step 1
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');
      await user.click(screen.getByLabelText(/^Male$/i));
      await user.type(screen.getByLabelText(/telephone/i), '+254712345678');

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Address')).toBeInTheDocument();
        expect(screen.getByLabelText(/physical address/i)).toBeInTheDocument();
      });
    });
  });

  describe('Step 2 - Address Information', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      // Navigate to step 2
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');
      await user.click(screen.getByLabelText(/^Male$/i));
      await user.type(screen.getByLabelText(/telephone/i), '+254712345678');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Address')).toBeInTheDocument();
      });
    });

    it('should validate required address fields', async () => {
      const user = userEvent.setup();
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/please provide a complete address/i)).toBeInTheDocument();
      });
    });

    it('should navigate back to step 1', async () => {
      const user = userEvent.setup();

      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      await waitFor(() => {
        expect(screen.getByText('Personal Info')).toBeInTheDocument();
        expect(screen.getByLabelText(/first name/i)).toHaveValue('John');
      });
    });

    it('should proceed to step 3 with valid address', async () => {
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/physical address/i), '123 Main St, Nairobi');
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('ID & Referee')).toBeInTheDocument();
      });
    });
  });

  describe('Step 3 - ID and Referee', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      // Navigate to step 3
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');
      await user.click(screen.getByLabelText(/^Male$/i));
      await user.type(screen.getByLabelText(/telephone/i), '+254712345678');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => expect(screen.getByText('Address')).toBeInTheDocument());

      await user.type(screen.getByLabelText(/physical address/i), '123 Main St');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('ID & Referee')).toBeInTheDocument();
      });
    });

    it('should validate required ID and next of kin fields', async () => {
      const user = userEvent.setup();
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/id\/passport number must be at least 5 characters/i)).toBeInTheDocument();
        expect(screen.getByText(/next of kin name must be at least 2 characters/i)).toBeInTheDocument();
        expect(screen.getByText(/next of kin phone must be in format \+254/i)).toBeInTheDocument();
        expect(screen.getByText(/relationship must be at least 2 characters/i)).toBeInTheDocument();
      });
    });

    it('should validate referee member number format', async () => {
      const user = userEvent.setup();

      const refereeInput = screen.getByLabelText(/referee member number/i);
      await user.type(refereeInput, 'INVALID123');

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/referee member number must be in format ATSC-YYYY-NNNN/i)).toBeInTheDocument();
      });
    });

    it('should proceed to step 4 with valid data', async () => {
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/id.*number/i), '12345678');
      await user.type(screen.getByLabelText(/next of kin name/i), 'Jane Doe');
      await user.type(screen.getByLabelText(/next of kin phone/i), '+254723456789');
      await user.type(screen.getByLabelText(/relationship/i), 'Spouse');

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Review')).toBeInTheDocument();
        expect(screen.getByText(/review & submit/i)).toBeInTheDocument();
      });
    });
  });

  describe('Step 4 - Review and Submit', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      // Navigate through all steps
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');
      await user.click(screen.getByLabelText(/^Male$/i));
      await user.type(screen.getByLabelText(/telephone/i), '+254712345678');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => expect(screen.getByText('Address')).toBeInTheDocument());
      await user.type(screen.getByLabelText(/physical address/i), '123 Main St');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => expect(screen.getByText('ID & Referee')).toBeInTheDocument());
      await user.type(screen.getByLabelText(/id.*number/i), '12345678');
      await user.type(screen.getByLabelText(/next of kin name/i), 'Jane Doe');
      await user.type(screen.getByLabelText(/next of kin phone/i), '+254723456789');
      await user.type(screen.getByLabelText(/relationship/i), 'Spouse');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/review & submit/i)).toBeInTheDocument();
      });
    });

    it('should display all entered information for review', () => {
      const nameRow = screen.getByText(/Name:/i).parentElement;
      const phoneRow = screen.getByText(/Phone:/i).parentElement;
      const idRow = screen.getByText(/ID Number:/i).parentElement;
      const nextOfKinRow = screen.getByText(/Next of Kin:/i).parentElement;

      expect(nameRow).toHaveTextContent('John');
      expect(nameRow).toHaveTextContent('Doe');
      expect(phoneRow).toHaveTextContent('+254712345678');
      expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
      expect(idRow).toHaveTextContent('12345678');
      expect(nextOfKinRow).toHaveTextContent('Jane Doe');
    });

    it('should validate email and password fields', async () => {
      const user = userEvent.setup();

      const submitButton = screen.getByRole('button', { name: /submit registration/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });
    });

    it('should validate password confirmation match', async () => {
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/^email address/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password/i), 'Password123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'DifferentPassword');

      const submitButton = screen.getByRole('button', { name: /submit registration/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/passwords don't match/i)).toBeInTheDocument();
      });
    });

    it('should validate terms and conditions agreement', async () => {
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/^email address/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password/i), 'Password123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'Password123!');

      const submitButton = screen.getByRole('button', { name: /submit registration/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/you must agree to the terms and conditions/i)).toBeInTheDocument();
        expect(screen.getByText(/you must agree to the refund policy/i)).toBeInTheDocument();
      });
    });

    it('should submit registration with valid data', async () => {
      const user = userEvent.setup();

      mockRegisterMember.mockResolvedValue({
        message: 'Registration successful',
        member: {
          id: '123',
          memberNumber: 'ATSC-2024-0001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        },
        access_token: 'mock-token',
      });

      await user.type(screen.getByLabelText(/^email address/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password/i), 'Password123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'Password123!');
      await user.click(screen.getByLabelText(/agree to the terms/i));
      await user.click(screen.getByLabelText(/agree to the.*refund policy/i));

      const submitButton = screen.getByRole('button', { name: /submit registration/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockRegisterMember).toHaveBeenCalledWith(
          expect.objectContaining({
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            telephone: '+254712345678',
          })
        );
        expect(mockPush).toHaveBeenCalledWith('/register/success?memberNumber=ATSC-2024-0001');
      });
    });

    it('should display error message on registration failure', async () => {
      const user = userEvent.setup();

      mockRegisterMember.mockRejectedValue({
        response: { data: { message: 'Email already exists' } },
      });

      await user.type(screen.getByLabelText(/^email address/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password/i), 'Password123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'Password123!');
      await user.click(screen.getByLabelText(/agree to the terms/i));
      await user.click(screen.getByLabelText(/agree to the.*refund policy/i));

      const submitButton = screen.getByRole('button', { name: /submit registration/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
      });
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();

      mockRegisterMember.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      await user.type(screen.getByLabelText(/^email address/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password/i), 'Password123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'Password123!');
      await user.click(screen.getByLabelText(/agree to the terms/i));
      await user.click(screen.getByLabelText(/agree to the.*refund policy/i));

      const submitButton = screen.getByRole('button', { name: /submit registration/i });
      await user.click(submitButton);

      expect(screen.getByText(/submitting/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Navigation and State Persistence', () => {
    it('should preserve form data when navigating between steps', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      // Fill step 1
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');
      await user.click(screen.getByLabelText(/^Male$/i));
      await user.type(screen.getByLabelText(/telephone/i), '+254712345678');
      await user.click(screen.getByRole('button', { name: /next/i }));

      // Go to step 2
      await waitFor(() => expect(screen.getByText('Address')).toBeInTheDocument());

      // Go back to step 1
      await user.click(screen.getByRole('button', { name: /back/i }));

      // Check data persistence
      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).toHaveValue('John');
        expect(screen.getByLabelText(/telephone/i)).toHaveValue('+254712345678');
      });
    });

    it('should allow clicking on completed step indicators', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      // Complete step 1 and 2
      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');
      await user.click(screen.getByLabelText(/^Male$/i));
      await user.type(screen.getByLabelText(/telephone/i), '+254712345678');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => expect(screen.getByText('Address')).toBeInTheDocument());
      await user.type(screen.getByLabelText(/physical address/i), '123 Main St');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => expect(screen.getByText('ID & Referee')).toBeInTheDocument());

      // Click on step 1 indicator (should be clickable now)
      const step1Button = screen.getAllByRole('button').find(
        (button) => button.textContent === '✓' || button.getAttribute('aria-label')?.includes('Step 1')
      );
      
      if (step1Button) {
        await user.click(step1Button);
        await waitFor(() => {
          expect(screen.getByText('Personal Info')).toBeInTheDocument();
        });
      }
    });
  });
});
