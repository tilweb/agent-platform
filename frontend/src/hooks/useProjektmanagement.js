/**
 * useProjektmanagement Hook
 * Manages Projektauftrag data for the Projektmanagement app
 */

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete, apiPostForm, API_URL } from '../utils/apiFetch';

export class VersionConflictError extends Error {
  constructor(currentServerData) {
    super('version_conflict');
    this.name = 'VersionConflictError';
    this.current = currentServerData;
  }
}

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

  // Phase A: Projekt-Entity (Top-Level). Lebt parallel zum Auftrag, gleiche ID.
  const getProjekt = useCallback(async (projektId) => {
    const response = await apiGet(`/apps/projektmanagement/projekte/${projektId}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.projekt;
  }, []);

  // Phase A/F: Projekt-Felder updaten (z.B. lifecycle nach Abschluss-Finalize).
  const updateProjekt = useCallback(async (projektId, updates) => {
    const response = await apiPut(`/apps/projektmanagement/projekte/${projektId}`, updates);
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update Projekt');
    }
    const data = await response.json();
    return data.projekt;
  }, []);

  // Update Projektauftrag
  const updateProjektauftrag = useCallback(async (projektId, updates, { expectedVersion, force = false } = {}) => {
    const body = { ...updates };
    if (expectedVersion !== undefined) body.expected_version = expectedVersion;
    if (force) body.force = true;
    const response = await apiPut(`/apps/projektmanagement/projektauftraege/${projektId}`, body);

    if (response.status === 409) {
      const data = await response.json();
      throw new VersionConflictError(data.current);
    }
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
  const updateStep = useCallback(async (projektId, step, data, { expectedVersion, force = false } = {}) => {
    const body = { ...data };
    if (expectedVersion !== undefined) body.expected_version = expectedVersion;
    if (force) body.force = true;
    const response = await apiPut(
      `/apps/projektmanagement/projektauftraege/${projektId}/step/${step}`,
      body
    );

    if (response.status === 409) {
      const conflictData = await response.json();
      throw new VersionConflictError(conflictData.current);
    }
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
  // Config Import/Export (Datei-Transport zwischen Kunden-Instanzen)
  // kind: 'export' (aktuelle Config) | 'template' (leeres Template)
  const downloadConfigFile = useCallback(async (kind, format = 'xlsx') => {
    const res = await fetch(
      `${API_URL}/apps/projektmanagement/config/${kind}?format=${format}`,
      { credentials: 'include' }
    );
    if (!res.ok) {
      let msg = 'Download fehlgeschlagen';
      try { msg = (await res.json()).error || msg; } catch { /* nicht-JSON */ }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = format === 'csv' ? 'csv' : 'xlsx';
    a.download = kind === 'template'
      ? `pm-auswahllisten-template.${ext}`
      : `pm-auswahllisten.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }, []);

  const previewConfigImport = useCallback(async (file) => {
    const form = new FormData();
    form.append('file', file);
    const res = await apiPostForm('/apps/projektmanagement/config/import/preview', form);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Import-Vorschau fehlgeschlagen');
    return data; // { lists, diff, warnings }
  }, []);

  const applyConfigImport = useCallback(async (lists, selectedKeys) => {
    const res = await apiPost('/apps/projektmanagement/config/import/apply', { lists, selectedKeys });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Import fehlgeschlagen');
    return data; // { config, applied }
  }, []);

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
  const updateStatusbericht = useCallback(async (projektId, sbId, updates, { expectedVersion, force = false } = {}) => {
    const body = { ...updates };
    if (expectedVersion !== undefined) body.expected_version = expectedVersion;
    if (force) body.force = true;
    const response = await apiPut(
      `/apps/projektmanagement/projektauftraege/${projektId}/statusberichte/${sbId}`,
      body
    );
    if (response.status === 409) {
      const conflictData = await response.json();
      throw new VersionConflictError(conflictData.current);
    }
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

  // ============== Lessons Learned (Phase E) ==============

  const getLessonsLearned = useCallback(async (projektId) => {
    const response = await apiGet(
      `/apps/projektmanagement/projektauftraege/${projektId}/lessons-learned`
    );
    if (!response.ok) throw new Error('Failed to load Lessons Learned');
    const data = await response.json();
    return data.lessons || [];
  }, []);

  const getLessonLearned = useCallback(async (projektId, llId) => {
    const response = await apiGet(
      `/apps/projektmanagement/projektauftraege/${projektId}/lessons-learned/${llId}`
    );
    if (!response.ok) throw new Error('Lesson Learned not found');
    const data = await response.json();
    return data.lesson;
  }, []);

  const createLessonLearned = useCallback(async (projektId, input) => {
    const response = await apiPost(
      `/apps/projektmanagement/projektauftraege/${projektId}/lessons-learned`,
      input
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to create Lesson Learned');
    }
    const data = await response.json();
    return data.lesson;
  }, []);

  const updateLessonLearned = useCallback(async (projektId, llId, updates, { expectedVersion } = {}) => {
    const body = { ...updates };
    if (expectedVersion !== undefined) body.expectedVersion = expectedVersion;
    const response = await apiPut(
      `/apps/projektmanagement/projektauftraege/${projektId}/lessons-learned/${llId}`,
      body
    );
    if (response.status === 409) {
      const data = await response.json();
      throw new VersionConflictError(data.current);
    }
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update Lesson Learned');
    }
    const data = await response.json();
    return data.lesson;
  }, []);

  const deleteLessonLearned = useCallback(async (projektId, llId) => {
    const response = await apiDelete(
      `/apps/projektmanagement/projektauftraege/${projektId}/lessons-learned/${llId}`
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete Lesson Learned');
    }
  }, []);

  // KI-Vorschlaege: lange laufender LLM-Call, kann mehrere Sekunden dauern.
  // Body ist leer — der Endpoint zieht die letzten Statusberichte selbst.
  const suggestLessonsLearned = useCallback(async (projektId) => {
    const response = await apiPost(
      `/apps/projektmanagement/projektauftraege/${projektId}/lessons-learned/suggest`,
      {}
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to suggest Lessons Learned');
    }
    const data = await response.json();
    return data.suggestions || [];
  }, []);

  // ============== Abschlussbericht (Phase F) ==============

  const getAbschlussbericht = useCallback(async (projektId) => {
    const response = await apiGet(
      `/apps/projektmanagement/projektauftraege/${projektId}/abschlussbericht`
    );
    if (!response.ok) throw new Error('Failed to load Abschlussbericht');
    const data = await response.json();
    return data.abschlussbericht;
  }, []);

  const createAbschlussbericht = useCallback(async (projektId, overrides) => {
    const response = await apiPost(
      `/apps/projektmanagement/projektauftraege/${projektId}/abschlussbericht`,
      overrides ? { overrides } : {}
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to create Abschlussbericht');
    }
    const data = await response.json();
    return data.abschlussbericht;
  }, []);

  const updateAbschlussbericht = useCallback(async (projektId, dataPatch, { expectedVersion } = {}) => {
    const body = { data: dataPatch };
    if (expectedVersion !== undefined) body.expectedVersion = expectedVersion;
    const response = await apiPut(
      `/apps/projektmanagement/projektauftraege/${projektId}/abschlussbericht`,
      body
    );
    if (response.status === 409) {
      const result = await response.json();
      throw new VersionConflictError(result.current);
    }
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || 'Failed to update Abschlussbericht');
    }
    const result = await response.json();
    return result.abschlussbericht;
  }, []);

  const deleteAbschlussbericht = useCallback(async (projektId) => {
    const response = await apiDelete(
      `/apps/projektmanagement/projektauftraege/${projektId}/abschlussbericht`
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete Abschlussbericht');
    }
  }, []);

  const finalizeAbschlussbericht = useCallback(async (projektId, { expectedVersion } = {}) => {
    const body = expectedVersion !== undefined ? { expectedVersion } : {};
    const response = await apiPost(
      `/apps/projektmanagement/projektauftraege/${projektId}/abschlussbericht/finalize`,
      body
    );
    if (response.status === 409) {
      const result = await response.json();
      throw new VersionConflictError(result.current);
    }
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to finalize Abschlussbericht');
    }
    const data = await response.json();
    return data.abschlussbericht;
  }, []);

  const reopenAbschlussbericht = useCallback(async (projektId, { expectedVersion } = {}) => {
    const body = expectedVersion !== undefined ? { expectedVersion } : {};
    const response = await apiPost(
      `/apps/projektmanagement/projektauftraege/${projektId}/abschlussbericht/reopen`,
      body
    );
    if (response.status === 409) {
      const result = await response.json();
      throw new VersionConflictError(result.current);
    }
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to reopen Abschlussbericht');
    }
    const data = await response.json();
    return data.abschlussbericht;
  }, []);

  const suggestAbschlussDraft = useCallback(async (projektId) => {
    const response = await apiPost(
      `/apps/projektmanagement/projektauftraege/${projektId}/abschlussbericht/suggest`,
      {}
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to suggest Abschlussbericht draft');
    }
    const data = await response.json();
    return data.suggestion;
  }, []);

  // ============== Portfolios (Phase D) ==============

  const listPortfolios = useCallback(async ({ status } = {}) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    const response = await apiGet(`/apps/projektmanagement/portfolios${qs}`);
    if (!response.ok) throw new Error('Failed to list portfolios');
    const data = await response.json();
    return data.portfolios || [];
  }, []);

  const getPortfolio = useCallback(async (portfolioId) => {
    const response = await apiGet(`/apps/projektmanagement/portfolios/${portfolioId}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Failed to get portfolio');
    const data = await response.json();
    return data.portfolio;
  }, []);

  const createPortfolio = useCallback(async (input) => {
    const response = await apiPost('/apps/projektmanagement/portfolios', input);
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to create portfolio');
    }
    const data = await response.json();
    return data.portfolio;
  }, []);

  const updatePortfolio = useCallback(async (portfolioId, updates, { expectedVersion } = {}) => {
    const body = expectedVersion !== undefined ? { ...updates, expectedVersion } : updates;
    const response = await apiPut(`/apps/projektmanagement/portfolios/${portfolioId}`, body);
    if (response.status === 409) {
      const data = await response.json();
      throw new VersionConflictError(data.current);
    }
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update portfolio');
    }
    const data = await response.json();
    return data.portfolio;
  }, []);

  const deletePortfolio = useCallback(async (portfolioId) => {
    const response = await apiDelete(`/apps/projektmanagement/portfolios/${portfolioId}`);
    if (!response.ok) throw new Error('Failed to delete portfolio');
    return true;
  }, []);

  const getPortfolioProjekte = useCallback(async (portfolioId) => {
    const response = await apiGet(`/apps/projektmanagement/portfolios/${portfolioId}/projekte`);
    if (!response.ok) throw new Error('Failed to list portfolio projekte');
    const data = await response.json();
    return data.projekte || [];
  }, []);

  const getAvailableProjekteForPortfolio = useCallback(async (portfolioId) => {
    const response = await apiGet(`/apps/projektmanagement/portfolios/${portfolioId}/projekte/available`);
    if (!response.ok) throw new Error('Failed to list available projekte');
    const data = await response.json();
    return data.projekte || [];
  }, []);

  const getPortfolioDashboard = useCallback(async (portfolioId) => {
    const response = await apiGet(`/apps/projektmanagement/portfolios/${portfolioId}/dashboard`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Failed to get portfolio dashboard');
    const data = await response.json();
    return data.dashboard;
  }, []);

  // Portfolio ↔ Projektidee (0..1)
  const getPortfolioIdeen = useCallback(async (portfolioId) => {
    const response = await apiGet(`/apps/projektmanagement/portfolios/${portfolioId}/ideen`);
    if (!response.ok) throw new Error('Failed to list portfolio ideen');
    const data = await response.json();
    return data.ideen || [];
  }, []);

  const getAvailableIdeenForPortfolio = useCallback(async (portfolioId) => {
    const response = await apiGet(`/apps/projektmanagement/portfolios/${portfolioId}/ideen/available`);
    if (!response.ok) throw new Error('Failed to list available ideen');
    const data = await response.json();
    return data.ideen || [];
  }, []);

  const assignIdeeToPortfolio = useCallback(async (portfolioId, ideeId) => {
    const response = await apiPut(`/apps/projektmanagement/portfolios/${portfolioId}/ideen/${ideeId}`, {});
    if (!response.ok) {
      const d = await response.json().catch(() => ({}));
      throw new Error(d.error || 'Failed to assign idee');
    }
  }, []);

  const unassignIdeeFromPortfolio = useCallback(async (portfolioId, ideeId) => {
    const response = await apiDelete(`/apps/projektmanagement/portfolios/${portfolioId}/ideen/${ideeId}`);
    if (!response.ok) {
      const d = await response.json().catch(() => ({}));
      throw new Error(d.error || 'Failed to unassign idee');
    }
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
    getProjekt,
    updateProjekt,
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
    downloadConfigFile,
    previewConfigImport,
    applyConfigImport,
    // Statusberichte
    getStatusberichte,
    getStatusbericht,
    createStatusbericht,
    updateStatusbericht,
    deleteStatusbericht,
    // Lessons Learned
    getLessonsLearned,
    getLessonLearned,
    createLessonLearned,
    updateLessonLearned,
    deleteLessonLearned,
    suggestLessonsLearned,
    // Abschlussbericht
    getAbschlussbericht,
    createAbschlussbericht,
    updateAbschlussbericht,
    deleteAbschlussbericht,
    finalizeAbschlussbericht,
    reopenAbschlussbericht,
    suggestAbschlussDraft,
    // Portfolios (Phase D)
    listPortfolios,
    getPortfolio,
    createPortfolio,
    updatePortfolio,
    deletePortfolio,
    getPortfolioProjekte,
    getAvailableProjekteForPortfolio,
    getPortfolioDashboard,
    getPortfolioIdeen,
    getAvailableIdeenForPortfolio,
    assignIdeeToPortfolio,
    unassignIdeeFromPortfolio,
  };
}
