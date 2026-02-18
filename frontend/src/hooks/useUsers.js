/**
 * useUsers Hook
 *
 * Custom hook for fetching users (for member selection).
 */

import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../utils/apiFetch';

export function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiGet('/users');
      if (!response.ok) {
        throw new Error('Failed to load users');
      }
      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  return {
    users,
    loading,
    error,
    refresh: loadUsers,
  };
}

export function useUserSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const search = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiGet(`/users/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error('Failed to search users');
      }
      const data = await response.json();
      setResults(data.users || []);
    } catch (err) {
      setError(err.message);
      console.error('Error searching users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResults([]);
  }, []);

  return {
    results,
    loading,
    error,
    search,
    clear,
  };
}
