import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/apiFetch';

const BASE = '/apps/vsm';

export function useVsm() {
  const [projekte, setProjekte] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProjekte = useCallback(async (filters = {}) => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.status) params.set('status', filters.status);

      const url = `${BASE}/projekte${params.toString() ? `?${params}` : ''}`;
      const response = await apiGet(url);

      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setProjekte(data.projekte || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const response = await apiGet(`${BASE}/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching VSM stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchProjekte();
    fetchStats();
  }, [fetchProjekte, fetchStats]);

  const createProjekt = useCallback(async (data) => {
    const response = await apiPost(`${BASE}/projekte`, data);
    if (!response.ok) throw new Error('Failed to create project');
    const result = await response.json();
    return result.projekt;
  }, []);

  const getProjekt = useCallback(async (id) => {
    const response = await apiGet(`${BASE}/projekte/${id}`);
    if (!response.ok) throw new Error('Project not found');
    const data = await response.json();
    return data.projekt;
  }, []);

  const updateProjekt = useCallback(async (id, updates) => {
    const response = await apiPut(`${BASE}/projekte/${id}`, updates);
    if (!response.ok) throw new Error('Failed to update project');
    const data = await response.json();
    return data.projekt;
  }, []);

  const updateVsmSection = useCallback(async (id, section, data) => {
    const response = await apiPut(`${BASE}/projekte/${id}/data/${section}`, { data });
    if (!response.ok) throw new Error('Failed to update section');
    const result = await response.json();
    return result.projekt;
  }, []);

  const deleteProjekt = useCallback(async (id) => {
    const response = await apiDelete(`${BASE}/projekte/${id}`);
    if (!response.ok) throw new Error('Failed to delete project');
  }, []);

  const runAnalyse = useCallback(async (id) => {
    const response = await apiPost(`${BASE}/projekte/${id}/analyse`, {});
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Analyse fehlgeschlagen');
    }
    const data = await response.json();
    return data;
  }, []);

  return {
    projekte,
    stats,
    isLoading,
    error,
    refresh: () => { fetchProjekte(); fetchStats(); },
    fetchProjekte,
    createProjekt,
    getProjekt,
    updateProjekt,
    updateVsmSection,
    deleteProjekt,
    runAnalyse,
  };
}
