/**
 * useProjektmanagement Hook
 * Manages Projektauftrag data for the Projektmanagement app
 */

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/apiFetch';

export function useProjektmanagement() {
  const [projektauftraege, setProjektauftraege] = useState([]);
  const [stats, setStats] = useState(null);
  const [vorlagen, setVorlagen] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch Projektauftraege list
  const fetchProjektauftraege = useCallback(async (filters = {}) => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.project_type) params.set('project_type', filters.project_type);
      if (filters.projektleiter) params.set('projektleiter', filters.projektleiter);
      if (filters.search) params.set('search', filters.search);

      const queryString = params.toString();
      const url = `/apps/projektmanagement/projektauftraege${queryString ? `?${queryString}` : ''}`;

      const response = await apiGet(url);

      if (!response.ok) {
        throw new Error('Failed to fetch Projektaufträge');
      }

      const data = await response.json();
      setProjektauftraege(data.projektauftraege || []);
    } catch (err) {
      console.error('Error fetching Projektaufträge:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await apiGet('/apps/projektmanagement/projektauftraege/stats');

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // Fetch Vorlagen
  const fetchVorlagen = useCallback(async () => {
    try {
      const response = await apiGet('/apps/projektmanagement/vorlagen');

      if (response.ok) {
        const data = await response.json();
        setVorlagen(data.vorlagen || []);
      }
    } catch (err) {
      console.error('Error fetching Vorlagen:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchProjektauftraege();
    fetchStats();
    fetchVorlagen();
  }, [fetchProjektauftraege, fetchStats, fetchVorlagen]);

  // Create a new Projektauftrag
  const createProjektauftrag = useCallback(async (data = {}) => {
    const response = await apiPost('/apps/projektmanagement/projektauftraege', data);

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || 'Failed to create Projektauftrag');
    }

    const result = await response.json();

    // Update local state
    setProjektauftraege((prev) => [result.projektauftrag, ...prev]);
    fetchStats();

    return result.projektauftrag;
  }, [fetchStats]);

  // Create from Vorlage
  const createFromVorlage = useCallback(async (vorlageId) => {
    const response = await apiPost('/apps/projektmanagement/projektauftraege/from-vorlage', {
      vorlageId,
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || 'Failed to create from Vorlage');
    }

    const result = await response.json();

    // Update local state
    setProjektauftraege((prev) => [result.projektauftrag, ...prev]);
    fetchStats();

    return result.projektauftrag;
  }, [fetchStats]);

  // Get Projektauftrag details
  const getProjektauftrag = useCallback(async (projektId) => {
    const response = await apiGet(`/apps/projektmanagement/projektauftraege/${projektId}`);

    if (!response.ok) {
      throw new Error('Projektauftrag not found');
    }

    const data = await response.json();
    return data;
  }, []);

  // Update Projektauftrag
  const updateProjektauftrag = useCallback(async (projektId, updates) => {
    const response = await apiPut(`/apps/projektmanagement/projektauftraege/${projektId}`, updates);

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update Projektauftrag');
    }

    const data = await response.json();

    // Update local state
    setProjektauftraege((prev) =>
      prev.map((p) => (p.id === projektId ? data.projektauftrag : p))
    );
    fetchStats();

    return data.projektauftrag;
  }, [fetchStats]);

  // Update specific step
  const updateStep = useCallback(async (projektId, step, data) => {
    const response = await apiPut(
      `/apps/projektmanagement/projektauftraege/${projektId}/step/${step}`,
      data
    );

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || 'Failed to update step');
    }

    const result = await response.json();

    // Update local state
    setProjektauftraege((prev) =>
      prev.map((p) => (p.id === projektId ? result.projektauftrag : p))
    );

    return result;
  }, []);

  // Delete Projektauftrag
  const deleteProjektauftrag = useCallback(async (projektId) => {
    const response = await apiDelete(`/apps/projektmanagement/projektauftraege/${projektId}`);

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete Projektauftrag');
    }

    // Update local state
    setProjektauftraege((prev) => prev.filter((p) => p.id !== projektId));
    fetchStats();
  }, [fetchStats]);

  // Search Projektauftraege
  const searchProjektauftraege = useCallback(async (query) => {
    const response = await apiGet(`/apps/projektmanagement/search?q=${encodeURIComponent(query)}`);

    if (!response.ok) {
      throw new Error('Search failed');
    }

    const data = await response.json();
    return data.projektauftraege || [];
  }, []);

  // Validate step
  const validateStep = useCallback(async (projektId, step) => {
    const response = await apiPost(
      `/apps/projektmanagement/projektauftraege/${projektId}/validate/${step}`,
      {}
    );

    if (!response.ok) {
      throw new Error('Validation failed');
    }

    const data = await response.json();
    return data.validation;
  }, []);

  // Export Projektauftrag
  const exportProjektauftrag = useCallback(async (projektId, format = 'json') => {
    const response = await apiGet(
      `/apps/projektmanagement/projektauftraege/${projektId}/export/${format}`
    );

    if (!response.ok) {
      throw new Error('Export failed');
    }

    if (format === 'json') {
      return await response.json();
    } else {
      return await response.text();
    }
  }, []);

  // Get all knowledge summaries
  const getKnowledgeSummary = useCallback(async () => {
    const response = await apiGet('/apps/projektmanagement/knowledge');

    if (!response.ok) {
      throw new Error('Failed to load knowledge');
    }

    const data = await response.json();
    return data.knowledge;
  }, []);

  // Get knowledge for a specific step
  const getStepKnowledge = useCallback(async (step) => {
    const response = await apiGet(`/apps/projektmanagement/knowledge/${step}`);

    if (!response.ok) {
      throw new Error('Failed to load step knowledge');
    }

    const data = await response.json();
    return data.knowledge;
  }, []);

  // Get analysis prompt for a step
  const getAnalysisPrompt = useCallback(async (step) => {
    const response = await apiGet(`/apps/projektmanagement/knowledge/${step}/prompt`);

    if (!response.ok) {
      throw new Error('Failed to generate analysis prompt');
    }

    const data = await response.json();
    return data.prompt;
  }, []);

  // Analyze a step using LLM against Masterclass criteria
  const analyzeStep = useCallback(async (stepNumber, projektauftrag) => {
    const response = await apiPost(
      `/apps/projektmanagement/analyse/step/${stepNumber}`,
      { projektauftrag }
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Analyse fehlgeschlagen');
    }

    const data = await response.json();
    return data.analysis;
  }, []);

  // Generate overall project assessment (Gesamtbewertung)
  const analyzeGesamt = useCallback(async (projektauftrag, stepAnalyses = null) => {
    const response = await apiPost(
      '/apps/projektmanagement/analyse/gesamt',
      { projektauftrag, stepAnalyses }
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Gesamtbewertung fehlgeschlagen');
    }

    const data = await response.json();
    return data.gesamtbewertung;
  }, []);

  // Save knowledge for a step (sends JSON object, backend serializes to YAML)
  const saveKnowledge = useCallback(async (step, knowledge) => {
    const response = await apiPut(`/apps/projektmanagement/knowledge/${step}`, { knowledge });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save knowledge');
    }
    return await response.json();
  }, []);

  // Get app config (select options)
  const getConfig = useCallback(async () => {
    const response = await apiGet('/apps/projektmanagement/config');
    if (!response.ok) {
      throw new Error('Failed to load config');
    }
    return await response.json();
  }, []);

  // Update app config
  const updateConfig = useCallback(async (config) => {
    const response = await apiPut('/apps/projektmanagement/config', config);
    if (!response.ok) {
      throw new Error('Failed to save config');
    }
    return await response.json();
  }, []);

  // ============== Statusberichte ==============

  // Get all Statusberichte for a Projekt
  const getStatusberichte = useCallback(async (projektId) => {
    const response = await apiGet(
      `/apps/projektmanagement/projektauftraege/${projektId}/statusberichte`
    );
    if (!response.ok) throw new Error('Failed to load Statusberichte');
    const data = await response.json();
    return data.statusberichte || [];
  }, []);

  // Get single Statusbericht
  const getStatusbericht = useCallback(async (projektId, sbId) => {
    const response = await apiGet(
      `/apps/projektmanagement/projektauftraege/${projektId}/statusberichte/${sbId}`
    );
    if (!response.ok) throw new Error('Statusbericht not found');
    const data = await response.json();
    return data.statusbericht;
  }, []);

  // Create new Statusbericht
  const createStatusbericht = useCallback(async (projektId) => {
    const response = await apiPost(
      `/apps/projektmanagement/projektauftraege/${projektId}/statusberichte`,
      {}
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to create Statusbericht');
    }
    const data = await response.json();
    return data.statusbericht;
  }, []);

  // Update Statusbericht
  const updateStatusbericht = useCallback(async (projektId, sbId, updates) => {
    const response = await apiPut(
      `/apps/projektmanagement/projektauftraege/${projektId}/statusberichte/${sbId}`,
      updates
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update Statusbericht');
    }
    const data = await response.json();
    return data.statusbericht;
  }, []);

  // Delete Statusbericht (only draft)
  const deleteStatusbericht = useCallback(async (projektId, sbId) => {
    const response = await apiDelete(
      `/apps/projektmanagement/projektauftraege/${projektId}/statusberichte/${sbId}`
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete Statusbericht');
    }
  }, []);

  // Get Statusberichte Dashboard
  const getStatusberichteDashboard = useCallback(async () => {
    const response = await apiGet('/apps/projektmanagement/statusberichte/dashboard');
    if (!response.ok) throw new Error('Failed to load dashboard');
    const data = await response.json();
    return data.dashboard || [];
  }, []);

  return {
    projektauftraege,
    stats,
    vorlagen,
    isLoading,
    error,
    // Actions
    refresh: fetchProjektauftraege,
    refreshStats: fetchStats,
    refreshVorlagen: fetchVorlagen,
    createProjektauftrag,
    createFromVorlage,
    getProjektauftrag,
    updateProjektauftrag,
    updateStep,
    deleteProjektauftrag,
    searchProjektauftraege,
    validateStep,
    exportProjektauftrag,
    // Knowledge
    getKnowledgeSummary,
    getStepKnowledge,
    saveKnowledge,
    getAnalysisPrompt,
    // KI-Analyse
    analyzeStep,
    analyzeGesamt,
    // Config
    getConfig,
    updateConfig,
    // Statusberichte
    getStatusberichte,
    getStatusbericht,
    createStatusbericht,
    updateStatusbericht,
    deleteStatusbericht,
    getStatusberichteDashboard,
  };
}
