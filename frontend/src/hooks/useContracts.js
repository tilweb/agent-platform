/**
 * useContracts Hook
 * Manages contract data for the Vertragsmanagement app
 */

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPostForm, apiPut, apiDelete } from '../utils/apiFetch';

export function useContracts() {
  const [contracts, setContracts] = useState([]);
  const [stats, setStats] = useState(null);
  const [schemas, setSchemas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch contracts list
  const fetchContracts = useCallback(async (filters = {}) => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.type) params.set('type', filters.type);
      if (filters.status) params.set('status', filters.status);
      if (filters.party) params.set('party', filters.party);
      if (filters.search) params.set('search', filters.search);

      const queryString = params.toString();
      const url = `/apps/vertragsmanagement/contracts${queryString ? `?${queryString}` : ''}`;

      const response = await apiGet(url);

      if (!response.ok) {
        throw new Error('Failed to fetch contracts');
      }

      const data = await response.json();
      setContracts(data.contracts || []);
    } catch (err) {
      console.error('Error fetching contracts:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await apiGet('/apps/vertragsmanagement/contracts/stats');

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // Fetch schemas
  const fetchSchemas = useCallback(async () => {
    try {
      const response = await apiGet('/apps/vertragsmanagement/schemas');

      if (response.ok) {
        const data = await response.json();
        setSchemas(data.schemas || []);
      }
    } catch (err) {
      console.error('Error fetching schemas:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchContracts();
    fetchStats();
    fetchSchemas();
  }, [fetchContracts, fetchStats, fetchSchemas]);

  // Upload a new contract
  const uploadContract = useCallback(async (file, contractType) => {
    const formData = new FormData();
    formData.append('file', file);
    if (contractType) {
      formData.append('contractType', contractType);
    }

    const response = await apiPostForm('/apps/vertragsmanagement/contracts', formData);

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to upload contract');
    }

    const data = await response.json();

    // Update local state
    setContracts((prev) => [data.contract, ...prev]);

    // Refresh stats
    fetchStats();

    return data.contract;
  }, [fetchStats]);

  // Get contract details
  const getContract = useCallback(async (contractId) => {
    const response = await apiGet(`/apps/vertragsmanagement/contracts/${contractId}`);

    if (!response.ok) {
      throw new Error('Contract not found');
    }

    const data = await response.json();
    return data.contract;
  }, []);

  // Get contract document text
  const getContractDocument = useCallback(async (contractId) => {
    const response = await apiGet(`/apps/vertragsmanagement/contracts/${contractId}/document`);

    if (!response.ok) {
      throw new Error('Document not found');
    }

    const data = await response.json();
    return data.document;
  }, []);

  // Update contract metadata
  const updateContract = useCallback(async (contractId, extracted) => {
    const response = await apiPut(`/apps/vertragsmanagement/contracts/${contractId}`, {
      extracted,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update contract');
    }

    const data = await response.json();

    // Update local state
    setContracts((prev) =>
      prev.map((c) => (c.id === contractId ? data.contract : c))
    );

    // Refresh stats
    fetchStats();

    return data.contract;
  }, [fetchStats]);

  // Delete contract
  const deleteContract = useCallback(async (contractId) => {
    const response = await apiDelete(`/apps/vertragsmanagement/contracts/${contractId}`);

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete contract');
    }

    // Update local state
    setContracts((prev) => prev.filter((c) => c.id !== contractId));

    // Refresh stats
    fetchStats();
  }, [fetchStats]);

  // Search contracts
  const searchContracts = useCallback(async (query) => {
    const response = await apiGet(`/apps/vertragsmanagement/search?q=${encodeURIComponent(query)}`);

    if (!response.ok) {
      throw new Error('Search failed');
    }

    const data = await response.json();
    return data.contracts || [];
  }, []);

  // Get expiring contracts
  const getExpiringContracts = useCallback(async (days = 90) => {
    const response = await apiGet(`/apps/vertragsmanagement/expiring?days=${days}`);

    if (!response.ok) {
      throw new Error('Failed to fetch expiring contracts');
    }

    const data = await response.json();
    return data.contracts || [];
  }, []);

  // Get schema by type
  const getSchema = useCallback(
    (typeId) => schemas.find((s) => s.id === typeId) || null,
    [schemas]
  );

  // Create a new schema
  const createSchema = useCallback(async (schema) => {
    const response = await apiPost('/apps/vertragsmanagement/schemas', schema);

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to create schema');
    }

    const data = await response.json();

    // Update local state
    setSchemas((prev) => [...prev, data.schema]);

    return data.schema;
  }, []);

  // Update a schema
  const updateSchema = useCallback(async (typeId, updates) => {
    const response = await apiPut(`/apps/vertragsmanagement/schemas/${typeId}`, updates);

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update schema');
    }

    const data = await response.json();

    // Update local state
    setSchemas((prev) =>
      prev.map((s) => (s.id === typeId ? data.schema : s))
    );

    return data.schema;
  }, []);

  // Delete a schema
  const deleteSchema = useCallback(async (typeId) => {
    const response = await apiDelete(`/apps/vertragsmanagement/schemas/${typeId}`);

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete schema');
    }

    // Update local state
    setSchemas((prev) => prev.filter((s) => s.id !== typeId));
  }, []);

  return {
    contracts,
    stats,
    schemas,
    isLoading,
    error,
    // Actions
    refresh: fetchContracts,
    refreshStats: fetchStats,
    uploadContract,
    getContract,
    getContractDocument,
    updateContract,
    deleteContract,
    searchContracts,
    getExpiringContracts,
    // Schema management
    refreshSchemas: fetchSchemas,
    createSchema,
    updateSchema,
    deleteSchema,
    // Helpers
    getSchema,
  };
}
