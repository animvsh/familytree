// amapofeveryone/frontend/src/utils/api.js

/**
 * Base URL for the backend API.
 * Uses the `NEXT_PUBLIC_API_URL` environment variable if set, otherwise defaults to 'http://localhost:5000/api'.
 * `NEXT_PUBLIC_` prefix makes it available on the client-side in Next.js.
 * @type {string}
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * Generic request handler function.
 * This function is a wrapper around `fetch` to standardize API calls,
 * including setting JSON content type, adding JWT token from localStorage if available,
 * and consistent error handling.
 *
 * @async
 * @param {string} endpoint - The API endpoint to call (e.g., '/auth/login').
 * @param {object} [options={}] - Optional fetch options (method, body, custom headers, etc.).
 * @returns {Promise<object>} A promise that resolves to the JSON response data from the API.
 * @throws {Error} Throws an error if the network response is not ok, or if any other error occurs during the fetch.
 *                 The error object will typically have a `message` property from the API's JSON response (e.g., `data.msg`).
 */
async function request(endpoint, options = {}) {
  // Retrieve JWT token from localStorage if running in a browser environment.
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  // Default headers for JSON content.
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers, // Allow overriding or adding custom headers
  };

  // If a token exists, add it to the 'x-auth-token' header for authentication.
  if (token) {
    headers['x-auth-token'] = token;
  }

  try {
    // Perform the fetch request to the constructed API URL.
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options, // Spread any provided fetch options (method, body, etc.)
      headers,    // Set the constructed headers
    });

    // Attempt to parse the response body as JSON.
    // response.json() can throw an error if the body is not valid JSON.
    const data = await response.json();

    // Check if the HTTP response status code indicates success (e.g., 200-299).
    if (!response.ok) {
      // If not ok, throw an error. Use the 'msg' field from the backend's JSON error response if available,
      // otherwise, use a generic HTTP status error.
      throw new Error(data.msg || `HTTP error! status: ${response.status}`);
    }

    // If response is ok, return the parsed JSON data.
    return data;
  } catch (error) {
    // Log the error to the console for debugging.
    // This includes errors from fetch itself (network errors) or from response.json() parsing, or the thrown error above.
    console.error(`API call error (${options.method || 'GET'} ${API_URL}${endpoint}):`, error.message);
    // Re-throw the error so it can be caught and handled by the calling component/function.
    throw error;
  }
}

/**
 * Performs a GET request to the specified API endpoint.
 *
 * @async
 * @param {string} endpoint - The API endpoint for the GET request.
 * @returns {Promise<object>} A promise that resolves to the JSON response data.
 * @throws {Error} Throws an error if the API call fails.
 */
export async function getRequest(endpoint) {
  return request(endpoint, { method: 'GET' });
}

/**
 * Performs a POST request to the specified API endpoint.
 *
 * @async
 * @param {string} endpoint - The API endpoint for the POST request.
 * @param {object} body - The data to be sent in the request body (will be JSON.stringify'd).
 * @returns {Promise<object>} A promise that resolves to the JSON response data.
 * @throws {Error} Throws an error if the API call fails.
 */
export async function postRequest(endpoint, body) {
  return request(endpoint, {
    method: 'POST',
    body: JSON.stringify(body), // Convert the JavaScript object to a JSON string
  });
}

// Example for other HTTP methods if needed in the future:
// export async function putRequest(endpoint, body) {
//   return request(endpoint, {
//     method: 'PUT',
//     body: JSON.stringify(body),
//   });
// }

// export async function deleteRequest(endpoint) {
//   return request(endpoint, {
//     method: 'DELETE',
//   });
// }
