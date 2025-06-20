// amapofeveryone/frontend/src/app/dashboard/page.js
'use client'; // Client Component directive

import { useState, useEffect, useCallback } from 'react';
import { getRequest, postRequest } from '../../utils/api'; // API utilities
import { useRouter } from 'next/navigation'; // Hook for navigation

/**
 * DashboardPage Component
 * This page serves as the user's main interface after logging in.
 * It allows users to view their family web/relationships and add new relatives.
 * It handles authentication by checking for a JWT token in localStorage.
 */
export default function DashboardPage() {
  const router = useRouter();

  // State for storing the current user's ID, extracted from JWT.
  const [currentUserId, setCurrentUserId] = useState(null);

  const [relatives, setRelatives] = useState([]);

  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isLoadingRelatives, setIsLoadingRelatives] = useState(false);
  const [isAddingRelative, setIsAddingRelative] = useState(false);

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [relativeName, setRelativeName] = useState('');
  const [relativeBirthYear, setRelativeBirthYear] = useState('');
  const [relativeEmail, setRelativeEmail] = useState('');
  const [relativePhone, setRelativePhone] = useState('');
  const [relationshipType, setRelationshipType] = useState('Child');

  const relationshipTypes = ['Parent', 'Sibling', 'Spouse', 'Child', 'Cousin', 'Aunt/Uncle', 'Niece/Nephew', 'Grandparent', 'Grandchild', 'Friend', 'Other'];

  // State for invite code functionality
  const [inviteCode, setInviteCode] = useState('');
  const [isInviteCodeLoading, setIsInviteCodeLoading] = useState(false);
  const [inviteCodeError, setInviteCodeError] = useState('');
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);

  /**
   * Helper function to determine the inverse of a relationship type.
   * @param {string} type - The relationship type from one perspective.
   * @returns {string} The inverse relationship type.
   */
  const getInverseRelationshipType = (type) => {
    const map = {
      'Parent': 'Child',
      'Child': 'Parent',
      'Sibling': 'Sibling',
      'Spouse': 'Spouse',
      'Cousin': 'Cousin',
      'Aunt/Uncle': 'Niece/Nephew',
      'Niece/Nephew': 'Aunt/Uncle',
      'Grandparent': 'Grandchild',
      'Grandchild': 'Grandparent',
      'Friend': 'Friend',
      'Other': 'Other',
    };
    return map[type] || type; // Fallback to original if no specific inverse
  };

  /**
   * useEffect hook to parse JWT from localStorage and set currentUserId.
   * Runs once on component mount. Redirects to login if token is invalid or not found.
   */
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      try {
        // WARNING: Simplified, insecure JWT parsing. Use a library in production.
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload && payload.user && payload.user.id) {
          setCurrentUserId(payload.user.id);
        } else {
          throw new Error("Invalid token payload: user.id missing.");
        }
      } catch (e) {
        console.error("Failed to parse token or token is invalid:", e.message);
        if (typeof window !== 'undefined') localStorage.removeItem('token');
        router.push('/login');
      }
    } else {
      router.push('/login');
    }
  }, [router]); // Dependency: router.

  /**
   * Fetches the list of relatives for the current user.
   * Memoized with useCallback to prevent re-creation unless dependencies change.
   */
  const fetchRelatives = useCallback(async () => {
    // Ensure currentUserId is available before fetching.
    // This check is important though the calling useEffect also checks currentUserId.
    if (!currentUserId) {
      setIsLoadingPage(false); // If called without userId, stop page loading.
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      router.push('/login');
      return;
    }

    setIsLoadingRelatives(true);
    setError('');
    try {
      const data = await getRequest('/relationships/myfamily');
      setRelatives(data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch relatives.');
      const errorMsg = (err.message || '').toLowerCase();
      if (errorMsg.includes('no token') || errorMsg.includes('not valid') || errorMsg.includes('denied') || errorMsg.includes('expired')) {
        if (typeof window !== 'undefined') localStorage.removeItem('token');
        router.push('/login');
      }
    } finally {
      setIsLoadingRelatives(false);
      setIsLoadingPage(false); // Mark page loading as complete after first fetch attempt.
    }
  }, [router, currentUserId]); // Depends on router and currentUserId.

  /**
   * useEffect hook to call fetchRelatives when currentUserId is set.
   */
  useEffect(() => {
    if (currentUserId) {
      fetchRelatives();
    } else {
      // If currentUserId is not set (e.g., token parsing failed and redirected),
      // ensure page loading state is false.
      setIsLoadingPage(false);
    }
  }, [currentUserId, fetchRelatives]); // Depends on currentUserId and fetchRelatives.

  /**
   * Handles submission of the "Add Relative" form.
   */
  const handleAddRelative = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!relativeName || !relativeBirthYear || !relationshipType) {
      setError('Please fill in relative\'s name, birth year, and relationship type.');
      return;
    }
    if (isNaN(parseInt(relativeBirthYear))) {
      setError('Birth year must be a valid number.');
      return;
    }

    setIsAddingRelative(true);
    try {
      const newRelativeData = {
        relativeName,
        relativeBirthYear: parseInt(relativeBirthYear),
        relativeEmail: relativeEmail || undefined,
        relativePhone: relativePhone || undefined,
        relationshipType,
      };
      const result = await postRequest('/relationships/add', newRelativeData);
      setSuccessMessage(result.msg || 'Relative added successfully!');
      setRelativeName('');
      setRelativeBirthYear('');
      setRelativeEmail('');
      setRelativePhone('');
      setRelationshipType('Child');
      fetchRelatives(); // Refresh relatives list.
    } catch (err) {
      setError(err.message || 'Failed to add relative. Please try again.');
    } finally {
      setIsAddingRelative(false);
    }
  };

  /**
   * Handles user logout.
   */
  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
    setCurrentUserId(null);
    router.push('/login');
  };

  // Initial loading state for the page (authentication and first data fetch).
  if (isLoadingPage) {
    return <div className="container mx-auto p-4 text-center">Authenticating and loading dashboard...</div>;
  }
  // Fallback if user context couldn't be established (e.g. bad token redirect happened but component hasn't unmounted yet).
  if (!currentUserId) {
      return <div className="container mx-auto p-4 text-center">Session not valid. Redirecting to login...</div>;
  }

  /**
   * Handles fetching or generating the user's invite code from the backend.
   */
  const handleGetInviteCode = async () => {
    setIsInviteCodeLoading(true);
    setInviteCodeError('');
    setInviteLinkCopied(false); // Reset copy status
    try {
      // Empty POST request as user is identified by token.
      const data = await postRequest('/users/me/generate-invite-code', {});
      if (data.inviteCode) {
        setInviteCode(data.inviteCode);
      } else {
        throw new Error("Invite code not received from server.");
      }
    } catch (err) {
      setInviteCodeError(err.message || 'Failed to get invite code. Please try again.');
      setInviteCode(''); // Clear any old code if fetching new one failed
    } finally {
      setIsInviteCodeLoading(false);
    }
  };

  /**
   * Handles copying the generated invite link to the clipboard.
   */
  const handleCopyLink = () => {
    if (!inviteCode || typeof window === 'undefined') return;
    const inviteLink = `${window.location.origin}/register?invite=${inviteCode}`;
    navigator.clipboard.writeText(inviteLink)
      .then(() => {
        setInviteLinkCopied(true);
        setTimeout(() => setInviteLinkCopied(false), 2500); // Reset 'Copied!' message after 2.5 seconds
      })
      .catch(err => {
        console.error('Failed to copy invite link:', err);
        setInviteCodeError('Failed to copy link. Please try manually.'); // Update error state for copying
      });
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">My Family Dashboard</h1>
        <button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition duration-150"
        >
          Logout
        </button>
      </div>

      {error && <p className="bg-red-100 text-red-700 p-3 rounded-md mb-6 shadow">{error}</p>}
      {successMessage && <p className="bg-green-100 text-green-700 p-3 rounded-md mb-6 shadow">{successMessage}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-semibold mb-5 text-gray-700">Add New Relative</h2>
          <form onSubmit={handleAddRelative} className="space-y-4">
            {/* Form inputs remain the same as previous version, including disabled={isAddingRelative} */}
            <div>
              <label htmlFor="relativeName" className="block text-sm font-medium text-gray-600">Name*</label>
              <input type="text" id="relativeName" value={relativeName} onChange={(e) => setRelativeName(e.target.value)} required disabled={isAddingRelative} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50" />
            </div>
            <div>
              <label htmlFor="relativeBirthYear" className="block text-sm font-medium text-gray-600">Birth Year*</label>
              <input type="number" id="relativeBirthYear" value={relativeBirthYear} onChange={(e) => setRelativeBirthYear(e.target.value)} required disabled={isAddingRelative} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50" />
            </div>
            <div>
              <label htmlFor="relativeEmail" className="block text-sm font-medium text-gray-600">Email</label>
              <input type="email" id="relativeEmail" value={relativeEmail} onChange={(e) => setRelativeEmail(e.target.value)} disabled={isAddingRelative} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50" />
            </div>
            <div>
              <label htmlFor="relativePhone" className="block text-sm font-medium text-gray-600">Phone</label>
              <input type="tel" id="relativePhone" value={relativePhone} onChange={(e) => setRelativePhone(e.target.value)} disabled={isAddingRelative} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50" />
            </div>
            <div>
              <label htmlFor="relationshipType" className="block text-sm font-medium text-gray-600">Relationship to You*</label>
              <select id="relationshipType" value={relationshipType} onChange={(e) => setRelationshipType(e.target.value)} required disabled={isAddingRelative} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50">
                {relationshipTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <button
              type="submit"
              disabled={isAddingRelative}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 transition duration-150"
            >
              {isAddingRelative ? 'Adding Relative...' : 'Add Relative'}
            </button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-semibold mb-5 text-gray-700">My Family Web</h2>
          {isLoadingRelatives && <p className="text-gray-600">Loading relatives...</p>}
          {!isLoadingRelatives && relatives.length === 0 && (
            <p className="text-gray-600 italic">No relatives added yet. Use the form to build your family web!</p>
          )}

          {relatives.length > 0 && currentUserId && (
            <ul className="space-y-4">
              {relatives.map(rel => {
                let otherPerson;
                let displayedRelationshipType; // This is how the other person is related to the current user.

                if (rel.user1._id === currentUserId) {
                  // Current user is user1. The 'otherPerson' is user2.
                  // rel.relationshipType is "how user1 (me) is related to user2".
                  // So, user2 is my [inverse of rel.relationshipType]. E.g., if I am "Parent" of user2, user2 is my "Child".
                  otherPerson = rel.user2;
                  displayedRelationshipType = getInverseRelationshipType(rel.relationshipType);
                } else if (rel.user2._id === currentUserId) {
                  // Current user is user2. The 'otherPerson' is user1.
                  // rel.relationshipType is "how user1 is related to user2 (me)".
                  // So, user1 is my [rel.relationshipType]. E.g., if user1 is "Parent" of me, user1 is my "Parent".
                  otherPerson = rel.user1;
                  displayedRelationshipType = rel.relationshipType;
                } else {
                  // This relationship does not directly involve the current user as user1 or user2.
                  // This should ideally not happen if the `/myfamily` endpoint is correctly filtered.
                  // As a fallback, display generic info or skip.
                  console.warn("Filtered relationship does not directly involve current user:", rel, currentUserId);
                  return ( // Or return null to skip rendering this item
                    <li key={rel._id} className="p-3 border rounded-md bg-gray-100 text-xs">
                      <p>Complex relationship: {rel.user1.name} &harr; {rel.user2.name} ({rel.relationshipType})</p>
                    </li>
                  );
                }

                return (
                  <li key={rel._id} className="p-4 border border-gray-200 rounded-lg shadow-sm bg-white hover:bg-indigo-50 transition-colors duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-indigo-700">{otherPerson.name}</span>
                      <span className="px-3 py-1 text-xs font-bold text-white bg-indigo-500 rounded-full shadow-sm">
                        {displayedRelationshipType} {/* This is the role of 'otherPerson' relative to 'currentUser' */}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                        <p>Born: {otherPerson.birthYear || 'N/A'}</p>
                        {otherPerson.email && <p>Email: {otherPerson.email}</p>}
                        {otherPerson.phone && <p>Phone: {otherPerson.phone}</p>}
                    </div>
                    <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
                      Relationship record created on: {new Date(rel.createdAt).toLocaleDateString()}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Invite Code Section */}
      <div className="mt-12 bg-white p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-semibold mb-5 text-gray-700">Invite Others to Connect</h2>
        {!inviteCode && (
          <button
            onClick={handleGetInviteCode}
            disabled={isInviteCodeLoading}
            className="w-full md:w-auto py-2.5 px-5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-60 transition duration-150"
          >
            {isInviteCodeLoading ? 'Generating Code...' : 'Get My Invite Code'}
          </button>
        )}
        {/* Display invite code error specifically for the invite code section */}
        {inviteCodeError && !successMessage && <p className="text-red-500 mt-3 bg-red-100 p-3 rounded-md">{inviteCodeError}</p>}

        {inviteCode && (
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="inviteCodeDisplay" className="block text-sm font-medium text-gray-600">Your unique invite code:</label>
              <input
                id="inviteCodeDisplay"
                type="text"
                readOnly
                value={inviteCode}
                className="mt-1 w-full md:w-auto max-w-xs px-4 py-2.5 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-800 font-mono text-lg focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="inviteLinkDisplay" className="block text-sm font-medium text-gray-600">Or share this direct invite link:</label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 mt-1">
                <input
                  id="inviteLinkDisplay"
                  type="text"
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/register?invite=${inviteCode}`}
                  className="flex-grow px-3 py-2.5 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-sm text-gray-700 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  onClick={handleCopyLink}
                  className="py-2.5 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md shadow-md text-sm whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150"
                >
                  {inviteLinkCopied ? 'Link Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/*
=============================================================================
CONCEPTUAL FRONTEND COMPONENT TESTS (Jest / React Testing Library Style)
=============================================================================

// import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
// import DashboardPage from './page';
// import * as api from '../../utils/api';
// import { useRouter } from 'next/navigation';

// jest.mock('next/navigation', () => ({
//   useRouter: jest.fn(() => ({ push: jest.fn() })),
// }));
// jest.mock('../../utils/api', () => ({
//   getRequest: jest.fn(),
//   postRequest: jest.fn(),
// }));

// // Helper to mock localStorage
// const localStorageMock = (() => {
//   let store = {};
//   return {
//     getItem: key => store[key] || null,
//     setItem: (key, value) => store[key] = value.toString(),
//     removeItem: key => delete store[key],
//     clear: () => store = {},
//   };
// })();
// Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// // Helper to mock atob for JWT parsing (simplified)
// global.atob = jest.fn(str => {
//   try {
//     if (str === 'valid.payload.signature_user123') { // Payload for { user: { id: 'user123' } }
//       return JSON.stringify({ user: { id: 'user123' } });
//     }
//     // Add more mock payloads if needed for different users or scenarios
//   } catch (e) { /* ignore, will return undefined */ }
//   // Fallback for invalid base64 or structure, causing JSON.parse to fail if not caught in component
//   return 'invalid_json_payload';
// });


describe('DashboardPage Component', () => {
//     // Add more mock payloads if needed for different users or scenarios
//   } catch (e) { /* ignore, will return undefined */ }
//   // Fallback for invalid base64 or structure, causing JSON.parse to fail if not caught in component
//   return 'invalid_json_payload';
// });


describe('DashboardPage Component', () => {
  // let mockPush;
  // let mockGetRequest;
  // let mockPostRequest;

  // beforeEach(() => {
  //   mockPush = jest.fn();
  //   useRouter.mockImplementation(() => ({ push: mockPush }));
  //   mockGetRequest = api.getRequest;
  //   mockPostRequest = api.postRequest;
  //   localStorage.clear();
  //   global.atob.mockClear(); // Clear atob call history
  //   // Reset component-level state if necessary, though re-rendering usually handles this
  // });

  describe('Authentication and Initial Load', () => {
    it('should redirect to /login if no token is found', () => {
      // render(<DashboardPage />);
      // expect(mockPush).toHaveBeenCalledWith('/login');
    });

    it('should parse token, set currentUserId, and attempt to fetch relatives if token exists', async () => {
      // localStorage.setItem('token', 'valid.payload.signature_user123');
      // // atob will be called by the component's useEffect

      // mockGetRequest.mockResolvedValueOnce([]); // Mock for fetchRelatives
      // render(<DashboardPage />);

      // await waitFor(() => expect(global.atob).toHaveBeenCalledWith('payload.signature_user123'));
      // await waitFor(() => expect(screen.getByRole('heading', { name: /my family dashboard/i })).toBeInTheDocument());
      // await waitFor(() => expect(mockGetRequest).toHaveBeenCalledWith('/relationships/myfamily'));
    });

    it('should show loading state initially then display "No relatives added yet" if API returns empty array', async () => {
      // localStorage.setItem('token', 'valid.payload.signature_user123');
      // mockGetRequest.mockResolvedValueOnce([]);
      // render(<DashboardPage />);
      // // Check for initial loading state if it's distinctly testable before data/empty message appears
      // // await waitFor(() => expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument(), { timeout: 100 }); // Or similar
      // await waitFor(() => expect(screen.getByText('No relatives added yet. Use the form to build your family web!')).toBeInTheDocument());
    });

    it('should display fetched relatives correctly from user1 perspective', async () => {
      // localStorage.setItem('token', 'valid.payload.signature_user123'); // Logged in as user123
      // const mockRelatives = [
      //   { _id: 'rel1', user1: { _id: 'user123', name: 'Me', birthYear: 1990 }, user2: { _id: 'user456', name: 'Child Name', birthYear: 2020, email: 'child@example.com' }, relationshipType: 'Parent', createdAt: new Date().toISOString() },
      // ];
      // mockGetRequest.mockResolvedValueOnce(mockRelatives);
      // render(<DashboardPage />);
      // await waitFor(() => expect(screen.getByText('Child Name')).toBeInTheDocument());
      // // If I am 'Parent' of 'Child Name', then 'Child Name' is my 'Child'.
      // await waitFor(() => expect(screen.getByText('Child')).toBeInTheDocument());
    });

    it('should display fetched relatives correctly from user2 perspective', async () => {
      // localStorage.setItem('token', 'valid.payload.signature_user123'); // Logged in as user123
      // const mockRelatives = [
      //    { _id: 'rel2', user1: { _id: 'user789', name: 'Parent Name', birthYear: 1960 }, user2: { _id: 'user123', name: 'Me', birthYear: 1990, email: 'me@example.com' }, relationshipType: 'Parent', createdAt: new Date().toISOString() },
      // ];
      // mockGetRequest.mockResolvedValueOnce(mockRelatives);
      // render(<DashboardPage />);
      // await waitFor(() => expect(screen.getByText('Parent Name')).toBeInTheDocument());
      // // If 'Parent Name' is 'Parent' of me (user123/user2), then 'Parent Name' is my 'Parent'.
      // await waitFor(() => expect(screen.getByText('Parent')).toBeInTheDocument());
    });

    it('should display error message if fetching relatives fails', async () => {
      // localStorage.setItem('token', 'valid.payload.signature_user123');
      // mockGetRequest.mockRejectedValueOnce(new Error('Failed to fetch relatives.'));
      // render(<DashboardPage />);
      // await waitFor(() => expect(screen.getByText('Failed to fetch relatives.')).toBeInTheDocument());
    });
  });

  describe('Add Relative Form', () => {
    // beforeEach(async () => { // Ensure user is "logged in" and initial data load is mocked for each test in this suite
    //   localStorage.setItem('token', 'valid.payload.signature_user123');
    //   mockGetRequest.mockResolvedValue([]); // Mock initial empty relatives list
    //   // Render the component or ensure it's rendered before each test if state needs to be pre-set by rendering
    //   // For example, by having render(<DashboardPage />) here, but that might re-render too often.
    //   // Usually, render is called inside each 'it' block unless there's a very specific setup need.
    // });

    it('should render the "Add New Relative" form', async () => {
      // localStorage.setItem('token', 'valid.payload.signature_user123'); // Need this for the component to render past auth
      // mockGetRequest.mockResolvedValueOnce([]); // For initial load
      // render(<DashboardPage />);
      // await waitFor(() => expect(screen.getByRole('heading', { name: /add new relative/i })).toBeInTheDocument());
      // expect(screen.getByLabelText(/Name\*/i)).toBeInTheDocument();
      // expect(screen.getByLabelText(/Birth Year\*/i)).toBeInTheDocument();
      // expect(screen.getByLabelText(/Relationship to You\*/i)).toBeInTheDocument();
      // expect(screen.getByRole('button', { name: /add relative/i })).toBeInTheDocument();
    });

    it('should allow typing in add relative form fields', async () => {
      // localStorage.setItem('token', 'valid.payload.signature_user123');
      // mockGetRequest.mockResolvedValueOnce([]);
      // render(<DashboardPage />);
      // await waitFor(() => screen.getByLabelText(/Name\*/i));
      // fireEvent.change(screen.getByLabelText(/Name\*/i), { target: { value: 'New Sibling' } });
      // fireEvent.change(screen.getByLabelText(/Birth Year\*/i), { target: { value: '1992' } });
      // fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'sibling@example.com' } }); // Non-required version
      // fireEvent.select(screen.getByLabelText(/Relationship to You\*/i), { target: { value: 'Sibling' } });
      // expect(screen.getByLabelText(/Name\*/i).value).toBe('New Sibling');
      // expect(screen.getByLabelText(/Birth Year\*/i).value).toBe('1992');
      // expect(screen.getByLabelText(/Relationship to You\*/i).value).toBe('Sibling');
    });

    it('should show error if required fields are missing on add relative submit', async () => {
      // localStorage.setItem('token', 'valid.payload.signature_user123');
      // mockGetRequest.mockResolvedValueOnce([]);
      // render(<DashboardPage />);
      // await waitFor(() => screen.getByRole('button', { name: /add relative/i }));
      // fireEvent.click(screen.getByRole('button', { name: /add relative/i }));
      // expect(await screen.findByText("Please fill in relative's name, birth year, and relationship type.")).toBeInTheDocument();
    });

    it('should call add relative API and refresh list on success', async () => {
      // localStorage.setItem('token', 'valid.payload.signature_user123');
      // mockGetRequest.mockResolvedValueOnce([]) // Initial fetch: empty
      //               .mockResolvedValueOnce([{ _id: 'newrel1', user1: { _id: 'user123', name: 'Me' }, user2: { _id: 'newreluser', name: 'Added Relative', birthYear: 2000, email: '' }, relationshipType: 'Parent', createdAt: new Date().toISOString() }]); // Fetch after adding

      // mockPostRequest.mockResolvedValueOnce({ msg: 'Relative added successfully!' });

      // render(<DashboardPage />);
      // await waitFor(() => screen.getByLabelText(/Name\*/i));

      // fireEvent.change(screen.getByLabelText(/Name\*/i), { target: { value: 'Added Relative' } });
      // fireEvent.change(screen.getByLabelText(/Birth Year\*/i), { target: { value: '2000' } });
      // fireEvent.select(screen.getByLabelText(/Relationship to You\*/i), { target: { value: 'Child' } });
      // fireEvent.click(screen.getByRole('button', { name: /add relative/i }));

      // await waitFor(() => expect(mockPostRequest).toHaveBeenCalledWith('/relationships/add', {
      //   relativeName: 'Added Relative',
      //   relativeBirthYear: 2000,
      //   relativeEmail: undefined,
      //   relativePhone: undefined,
      //   relationshipType: 'Child',
      // }));
      // expect(await screen.findByText('Relative added successfully!')).toBeInTheDocument();
      // expect(await screen.findByText('Added Relative')).toBeInTheDocument();
      // expect(mockGetRequest).toHaveBeenCalledTimes(2);
    });

    it('should display error if add relative API call fails', async () => {
      // localStorage.setItem('token', 'valid.payload.signature_user123');
      // mockGetRequest.mockResolvedValueOnce([]);
      // mockPostRequest.mockRejectedValueOnce(new Error('Failed to add relative. Please try again.'));
      // render(<DashboardPage />);
      // await waitFor(() => screen.getByLabelText(/Name\*/i));

      // fireEvent.change(screen.getByLabelText(/Name\*/i), { target: { value: 'Fail Relative' } });
      // fireEvent.change(screen.getByLabelText(/Birth Year\*/i), { target: { value: '2000' } });
      // fireEvent.select(screen.getByLabelText(/Relationship to You\*/i), { target: { value: 'Friend' } });
      // fireEvent.click(screen.getByRole('button', { name: /add relative/i }));

      // expect(await screen.findByText('Failed to add relative. Please try again.')).toBeInTheDocument();
    });
  });

  describe('Logout', () => {
    it('should clear token and redirect to /login on logout button click', async () => {
      // localStorage.setItem('token', 'valid.payload.signature_user123');
      // mockGetRequest.mockResolvedValueOnce([]);
      // render(<DashboardPage />);
      // await waitFor(() => screen.getByRole('button', { name: /logout/i }));

      // fireEvent.click(screen.getByRole('button', { name: /logout/i }));
      // expect(localStorage.getItem('token')).toBeNull();
      // await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'));
    });
  });
});
*/
