// amapofeveryone/frontend/src/app/register/page.js
'use client'; // Marks this component as a Client Component

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation'; // For URL params
import { postRequest, getRequest } from '../../utils/api'; // Add getRequest
import Link from 'next/link'; // For navigation
import { useRouter } from 'next/navigation'; // For programmatic navigation

/**
 * RegisterPage Component
 * Renders the registration form, handles user input for registration details,
 * submits these details to the backend, and manages success (token storage, redirection)
 * or error states. Handles optional registration via an invite code.
 */
export default function RegisterPage() {
  // Existing state variables
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(''); // Optional field
  const [password, setPassword] = useState('');
  const [error, setError] = useState(''); // General form errors
  const [isLoading, setIsLoading] = useState(false); // For form submission loading state

  // New state for invite functionality
  const [urlInviteCode, setUrlInviteCode] = useState(null); // Stores invite code from URL
  const [inviterName, setInviterName] = useState('');
  const [relationshipToInviter, setRelationshipToInviter] = useState('');
  const [isInviteLoading, setIsInviteLoading] = useState(false); // For loading inviter's info
  const [inviteError, setInviteError] = useState(''); // For errors related to invite code processing

  const router = useRouter();
  const searchParams = useSearchParams(); // Hook to access URL query parameters

  // useEffect to process invite code from URL when component mounts or URL changes
  useEffect(() => {
    const codeFromUrl = searchParams.get('invite');
    if (codeFromUrl) {
      setUrlInviteCode(codeFromUrl);
      setIsInviteLoading(true); // Start loading inviter info
      setInviteError('');       // Clear previous invite errors
      setInviterName('');       // Clear previous inviter name

      async function fetchInviterInfo() {
        try {
          const data = await getRequest(`/users/info-by-invite-code/${codeFromUrl}`);
          if (data.inviterName) {
            setInviterName(data.inviterName);
          } else {
            throw new Error("Inviter name not found for the provided code.");
          }
        } catch (err) {
          setInviteError(err.message || 'Invalid invite code. Please check the link or register without an invite code.');
          setInviterName('');
          // Optionally, clear urlInviteCode if invalid, to revert to normal registration
          // setUrlInviteCode(null);
        } finally {
          setIsInviteLoading(false); // Stop loading inviter info
        }
      }
      fetchInviterInfo();
    } else {
      // If no invite code in URL, ensure invite states are reset
      setUrlInviteCode(null);
      setInviterName('');
      setInviteError('');
      setIsInviteLoading(false);
    }
  }, [searchParams]); // Re-run if searchParams (e.g., URL) change

  /**
   * Handles the form submission event for user registration.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Standard validations
    if (!name || !birthYear || !email || !password) {
      setError('Please fill in all required fields: Name, Birth Year, Email, and Password.');
      setIsLoading(false);
      return;
    }
    if (isNaN(parseInt(birthYear))) {
      setError('Birth year must be a valid number.');
      setIsLoading(false);
      return;
    }
    if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        setIsLoading(false);
        return;
    }
    // Validation for relationshipToInviter if registering via a valid invite
    if (urlInviteCode && inviterName && !relationshipToInviter) {
      setError(`Please select your relationship to ${inviterName}.`);
      setIsLoading(false);
      return;
    }

    try {
      // Prepare payload for the registration API
      const payload = {
        name,
        birthYear: parseInt(birthYear),
        email,
        phone: phone || undefined, // Send phone only if provided
        password,
      };

      // If registering through a valid invite, add invite details to payload
      if (urlInviteCode && inviterName && !inviteError) { // Ensure inviteError is clear
        payload.inviteCode = urlInviteCode;
        payload.relationshipToInviter = relationshipToInviter;
      }

      const data = await postRequest('/auth/register', payload);

      console.log('Registered, token:', data.token);

      // Store token and userId in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', data.token);
        try {
            // WARNING: Simplified, insecure JWT parsing. Use a library in production.
            const decodedToken = JSON.parse(atob(data.token.split('.')[1]));
            if (decodedToken && decodedToken.user && decodedToken.user.id) {
                localStorage.setItem('userId', decodedToken.user.id);
            }
        } catch (parseError) {
            console.error("Error parsing token during registration:", parseError);
            // Proceed without storing userId if parsing fails, dashboard will handle it
        }
      }

      router.push('/dashboard'); // Redirect to dashboard
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
      setIsLoading(false);
    }
    // No finally setIsLoading(false) here if redirecting successfully, as component unmounts.
  };

  // Define relationship types for the dropdown, consistent with backend
  const relationshipTypes = ['Parent', 'Child', 'Sibling', 'Spouse', 'Cousin', 'Aunt/Uncle', 'Niece/Nephew', 'Grandparent', 'Grandchild', 'Friend', 'Other'];

  return (
    <div className="container mx-auto p-4 max-w-md">
      <h1 className="text-3xl font-bold mb-2 text-center">Create an Account</h1>

      {/* Invite Code Information Section */}
      {isInviteLoading && (
        <p className="text-center text-indigo-600 p-3 rounded mb-4 animate-pulse">
          Validating invite code...
        </p>
      )}
      {inviteError && (
        <p className="text-red-700 bg-red-100 p-3 rounded mb-4 text-sm text-center">
          {inviteError}
        </p>
      )}
      {urlInviteCode && inviterName && !isInviteLoading && !inviteError && (
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-800 p-4 mb-6 rounded shadow-md" role="alert">
          <p className="font-bold text-md">Invited by {inviterName}</p>
          <p className="text-sm">You are joining the family web of {inviterName}. Please specify your relationship below.</p>
        </div>
      )}

      {/* General Form Error Display */}
      {error && (
        <p className="text-red-700 bg-red-100 p-3 rounded mb-4 text-sm text-center">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="name">Full Name*</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" disabled={isLoading || isInviteLoading} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="birthYear">Birth Year*</label>
          <input id="birthYear" type="number" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" disabled={isLoading || isInviteLoading} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="email">Email Address*</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" disabled={isLoading || isInviteLoading} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="phone">Phone Number (Optional)</label>
          <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" disabled={isLoading || isInviteLoading} />
        </div>

        {/* Conditional Relationship Dropdown for Invites */}
        {urlInviteCode && inviterName && !isInviteLoading && !inviteError && (
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="relationshipToInviter">
              How are you related to {inviterName}?*
            </label>
            <select
              id="relationshipToInviter"
              value={relationshipToInviter}
              onChange={(e) => setRelationshipToInviter(e.target.value)}
              required // Required only if it's an invite flow
              className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isLoading || isInviteLoading}
            >
              <option value="">-- Select Relationship --</option>
              {relationshipTypes.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="password">Password* (min. 6 characters)</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength="6" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" disabled={isLoading || isInviteLoading} />
        </div>

        <button
          type="submit"
          // Disable button if general form is loading OR if invite is loading and not yet resolved (or errored out)
          disabled={isLoading || (isInviteLoading && !inviteError && urlInviteCode)}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isLoading ? 'Registering...' : 'Register'}
        </button>
      </form>

      {!urlInviteCode && ( // Only show "Already have an account?" if not an invite flow, or adjust as preferred
        <p className="mt-4 text-center text-sm">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Log in
          </Link>
        </p>
      )}
    </div>
  );
}

/*
=============================================================================
CONCEPTUAL FRONTEND COMPONENT TESTS (Jest / React Testing Library Style)
=============================================================================

// import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// import RegisterPage from './page';
// import * as api from '../../utils/api';
// import { useRouter, useSearchParams } from 'next/navigation'; // Mock useSearchParams as well

// jest.mock('next/navigation', () => ({
//   useRouter: jest.fn(() => ({ push: jest.fn() })),
//   useSearchParams: jest.fn(() => ({ get: jest.fn() })), // Default mock for get
// }));
// jest.mock('../../utils/api', () => ({
//   postRequest: jest.fn(),
//   getRequest: jest.fn(), // Mock getRequest
// }));

describe('RegisterPage Component', () => {
  // let mockPush;
  // let mockPostRequest;
  // let mockGetRequest;
  // let mockUrlGet; // To control searchParams.get('invite')

  // beforeEach(() => {
  //   mockPush = jest.fn();
  //   mockUrlGet = jest.fn();
  //   useRouter.mockImplementation(() => ({ push: mockPush }));
  //   useSearchParams.mockImplementation(() => ({ get: mockUrlGet }));
  //   mockPostRequest = api.postRequest;
  //   mockGetRequest = api.getRequest;
  //   localStorage.clear();
  // });

  // afterEach(() => {
  //   jest.clearAllMocks();
  // });

  // ... (Standard registration tests from previous step would go here) ...

  describe('Invite Code Functionality', () => {
    // it('should fetch inviter name if invite code is in URL', async () => {
    //   mockUrlGet.mockReturnValueOnce('testinvitecode'); // Simulates ?invite=testinvitecode
    //   mockGetRequest.mockResolvedValueOnce({ inviterName: 'John Doe' });
    //   render(<RegisterPage />);
    //   expect(mockGetRequest).toHaveBeenCalledWith('/users/info-by-invite-code/testinvitecode');
    //   expect(await screen.findByText(/Invited by John Doe/i)).toBeInTheDocument();
    //   expect(screen.getByLabelText(/How are you related to John Doe/i)).toBeInTheDocument();
    // });

    // it('should display error if invite code is invalid', async () => {
    //   mockUrlGet.mockReturnValueOnce('invalidcode');
    //   mockGetRequest.mockRejectedValueOnce(new Error('Invalid invite code.'));
    //   render(<RegisterPage />);
    //   expect(await screen.findByText(/Invalid invite code./i)).toBeInTheDocument();
    // });

    // it('should require relationshipToInviter if registering with invite code', async () => {
    //   mockUrlGet.mockReturnValueOnce('testinvitecode');
    //   mockGetRequest.mockResolvedValueOnce({ inviterName: 'Jane Doe' });
    //   render(<RegisterPage />);
    //   await waitFor(() => expect(screen.getByText(/Invited by Jane Doe/i)).toBeInTheDocument()); // Ensure inviter info is loaded

    //   // Fill other form fields but not relationshipToInviter
    //   fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Invited User' } });
    //   fireEvent.change(screen.getByLabelText(/birth year/i), { target: { value: '2000' } });
    //   fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'invited@example.com' } });
    //   fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    //   fireEvent.click(screen.getByRole('button', { name: /register/i }));

    //   expect(await screen.findByText('Please select your relationship to Jane Doe.')).toBeInTheDocument();
    //   expect(mockPostRequest).not.toHaveBeenCalled();
    // });

    // it('should submit inviteCode and relationshipToInviter on successful invite registration', async () => {
    //   mockUrlGet.mockReturnValueOnce('validcode123');
    //   mockGetRequest.mockResolvedValueOnce({ inviterName: 'Alice Inviter' });
    //   mockPostRequest.mockResolvedValueOnce({ token: 'new-user-token' }); // Mock successful registration

    //   render(<RegisterPage />);
    //   await waitFor(() => expect(screen.getByText(/Invited by Alice Inviter/i)).toBeInTheDocument());

    //   fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Bob Newbie' } });
    //   fireEvent.change(screen.getByLabelText(/birth year/i), { target: { value: '1998' } });
    //   fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'bob@example.com' } });
    //   fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'bobpassword' } });
    //   fireEvent.change(screen.getByLabelText(/How are you related to Alice Inviter/i), { target: { value: 'Friend' } });
    //   fireEvent.click(screen.getByRole('button', { name: /register/i }));

    //   await waitFor(() => expect(mockPostRequest).toHaveBeenCalledWith('/auth/register', expect.objectContaining({
    //     name: 'Bob Newbie',
    //     email: 'bob@example.com',
    //     inviteCode: 'validcode123',
    //     relationshipToInviter: 'Friend',
    //   })));
    //   await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
    // });
  });
});
*/
