/**
 * apiFetch - Zentrale API-Utility mit automatischem credentials: 'include'
 *
 * Stellt sicher, dass alle API-Requests automatisch Cookies mitsenden
 * für korrektes Session-Handling.
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Basis-Fetch-Funktion mit credentials: 'include'
 */
export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

/**
 * GET Request
 */
export const apiGet = (endpoint) => apiFetch(endpoint, { method: 'GET' });

/**
 * POST Request mit JSON-Body
 */
export const apiPost = (endpoint, body) => apiFetch(endpoint, {
  method: 'POST',
  body: JSON.stringify(body),
});

/**
 * PUT Request mit JSON-Body
 */
export const apiPut = (endpoint, body) => apiFetch(endpoint, {
  method: 'PUT',
  body: JSON.stringify(body),
});

/**
 * DELETE Request
 */
export const apiDelete = (endpoint) => apiFetch(endpoint, { method: 'DELETE' });

/**
 * POST Request mit FormData (für File-Uploads)
 * Setzt KEINEN Content-Type Header - Browser setzt ihn automatisch mit Boundary
 */
export const apiPostForm = (endpoint, formData) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
  return fetch(url, {
    method: 'POST',
    credentials: 'include',
    body: formData,
    // KEIN Content-Type Header bei FormData!
  });
};

export { API_URL };
