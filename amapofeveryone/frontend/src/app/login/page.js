// amapofeveryone/frontend/src/app/login/page.js
'use client'; // Marks this component as a Client Component for Next.js App Router

import { useState } from 'react';
import { postRequest } from '../../utils/api'; // API utility for making POST requests
import Link from 'next/link'; // Next.js component for client-side navigation
import { useRouter } from 'next/navigation'; // Next.js hook for programmatic navigation

/**
 * LoginPage Component
 * Renders the login form, handles user input, submits login credentials to the backend,
 * and manages success (token storage, redirection) or error states.
 */
export default function LoginPage() {
  // State variables for form inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // State variable for displaying error messages to the user
  const [error, setError] = useState('');

  // State variable to manage loading status during API call
  const [isLoading, setIsLoading] = useState(false);

  // useRouter hook for programmatic navigation (e.g., redirecting after login)
  const router = useRouter();

  /**
   * Handles the form submission event for logging in.
   * @param {React.FormEvent<HTMLFormElement>} e - The form submission event.
   */
  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent default browser form submission which causes a page reload
    setError('');       // Clear any previous error messages
    setIsLoading(true); // Set loading state to true to disable button and show loading indicator

    // Basic client-side validation for required fields
    if (!email || !password) {
      setError('Please fill in both email and password.');
      setIsLoading(false); // Reset loading state
      return;
    }

    try {
      // Make API call to the login endpoint
      const data = await postRequest('/auth/login', { email, password });

      console.log('Logged in, token:', data.token); // Log token for debugging

      // Store the JWT token in localStorage if running in a browser environment
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', data.token);
      }

      // Redirect to the dashboard page upon successful login
      router.push('/dashboard');
      // No need to set isLoading to false here if redirecting immediately,
      // as the component will unmount. If there was a delay or success message
      // before redirect, then it would be necessary.

    } catch (err) {
      // If API call fails, display an error message
      setError(err.message || 'Login failed. Please check your credentials.');
      setIsLoading(false); // Reset loading state on error
    }
    // We don't set setIsLoading(false) here if router.push() is called in try,
    // because the component might unmount. However, if router.push() was conditional,
    // or if there was a success message before redirect, then a finally block or
    // explicit call in the try block would be good.
    // For this structure, setting it in catch is sufficient for error paths.
  };

  return (
    <div className="container mx-auto p-4 max-w-md"> {/* Centered container with max width */}
      <h1 className="text-3xl font-bold mb-6 text-center">Login</h1>

      {/* Display error message if 'error' state is not empty */}
      {error && (
        <p className="text-red-500 bg-red-100 p-3 rounded mb-4 text-center">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="email">
            Email Address
          </label>
          <input
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required // HTML5 required attribute
            disabled={isLoading} // Disable input when loading
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="password">
            Password
          </label>
          <input
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading} // Disable input when loading
          />
        </div>
        <button
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          type="submit"
          disabled={isLoading} // Disable button when loading
        >
          {isLoading ? 'Signing In...' : 'Sign In'} {/* Change button text when loading */}
        </button>
      </form>

      <p className="mt-4 text-center text-sm">
        Don't have an account?{' '}
        <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
          Register here
        </Link>
      </p>
    </div>
  );
}

/*
=============================================================================
CONCEPTUAL FRONTEND COMPONENT TESTS (Jest / React Testing Library Style)
=============================================================================

// import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// import LoginPage from './page'; // Component import
// import * as api from '../../utils/api'; // To mock postRequest
// import { useRouter } from 'next/navigation'; // To mock router

// Mock next/navigation
// jest.mock('next/navigation', () => ({
//   useRouter: jest.fn(() => ({ push: jest.fn() })),
// }));

// Mock utils/api
// jest.mock('../../utils/api', () => ({
//   postRequest: jest.fn(),
// }));

describe('LoginPage Component', () => {
  // let mockPush;
  // let mockPostRequest;

  // beforeEach(() => {
  //   mockPush = jest.fn();
  //   useRouter.mockImplementation(() => ({ push: mockPush }));
  //   mockPostRequest = api.postRequest;
  //   localStorage.clear(); // Clear localStorage before each test
  // });

  // afterEach(() => {
  //   jest.clearAllMocks();
  // });

  it('should render the login form correctly', () => {
    // render(<LoginPage />);
    // expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
    // expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    // expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    // expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    // expect(screen.getByText(/don't have an account?/i)).toBeInTheDocument();
  });

  it('should allow typing in email and password fields', () => {
    // render(<LoginPage />);
    // const emailInput = screen.getByLabelText(/email address/i);
    // const passwordInput = screen.getByLabelText(/password/i);
    // fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    // fireEvent.change(passwordInput, { target: { value: 'password123' } });
    // expect(emailInput.value).toBe('test@example.com');
    // expect(passwordInput.value).toBe('password123');
  });

  it('should show error message if fields are empty on submit', async () => {
    // render(<LoginPage />);
    // fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    // expect(await screen.findByText('Please fill in both email and password.')).toBeInTheDocument();
    // expect(mockPostRequest).not.toHaveBeenCalled();
  });

  it('should call login API, store token, and redirect on successful login', async () => {
    // mockPostRequest.mockResolvedValueOnce({ token: 'fake-jwt-token' });
    // render(<LoginPage />);
    // fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } });
    // fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    // fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // await waitFor(() => expect(mockPostRequest).toHaveBeenCalledWith('/auth/login', {
    //   email: 'test@example.com',
    //   password: 'password123',
    // }));
    // await waitFor(() => expect(localStorage.getItem('token')).toBe('fake-jwt-token'));
    // await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
  });

  it('should display error message from API on failed login', async () => {
    // mockPostRequest.mockRejectedValueOnce(new Error('Invalid credentials'));
    // render(<LoginPage />);
    // fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } });
    // fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    // fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    // expect(localStorage.getItem('token')).toBeNull();
    // expect(mockPush).not.toHaveBeenCalled();
  });

  it('should disable button and show loading text during API call', async () => {
    // mockPostRequest.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ token: 'token' }), 100)));
    // render(<LoginPage />);
    // fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } });
    // fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    // const button = screen.getByRole('button', { name: /sign in/i });
    // fireEvent.click(button);

    // expect(button).toBeDisabled();
    // expect(button).toHaveTextContent(/signing in.../i);
    // await waitFor(() => expect(button).not.toBeDisabled());
    // expect(button).toHaveTextContent(/sign in/i);
  });
});
*/
