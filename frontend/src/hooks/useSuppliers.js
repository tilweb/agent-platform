/**
 * useSuppliers Hook
 * Manages supplier data for the Lieferantenmanagement app
 */

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete, apiPostForm } from '../utils/apiFetch';

const BASE = '/apps/lieferantenmanagement';

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [stats, setStats] = useState(null);
  const [config, setConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch config
  const fetchConfig = useCallback(async () => {
    try {
      const response = await apiGet(`${BASE}/config`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  }, []);

  // Fetch suppliers
  const fetchSuppliers = useCallback(async (filters = {}) => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.status) params.set('status', filters.status);
      if (filters.abteilung) params.set('abteilung', filters.abteilung);
      if (filters.bia_level) params.set('bia_level', filters.bia_level);
      if (filters.dora !== undefined) params.set('dora', String(filters.dora));

      const qs = params.toString();
      const url = `${BASE}/suppliers${qs ? `?${qs}` : ''}`;
      const response = await apiGet(url);

      if (!response.ok) throw new Error('Failed to fetch suppliers');

      const data = await response.json();
      setSuppliers(data.suppliers || []);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await apiGet(`${BASE}/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // Create supplier
  const createSupplier = useCallback(async (data) => {
    const response = await apiPost(`${BASE}/suppliers`, data);
    if (!response.ok) throw new Error('Failed to create supplier');
    const result = await response.json();
    return result.supplier;
  }, []);

  // Get single supplier
  const getSupplier = useCallback(async (id) => {
    const response = await apiGet(`${BASE}/suppliers/${id}`);
    if (!response.ok) throw new Error('Failed to get supplier');
    const data = await response.json();
    return data.supplier;
  }, []);

  // Update supplier
  const updateSupplier = useCallback(async (id, data) => {
    const response = await apiPut(`${BASE}/suppliers/${id}`, data);
    if (!response.ok) throw new Error('Failed to update supplier');
    const result = await response.json();
    return result.supplier;
  }, []);

  // Delete supplier
  const deleteSupplier = useCallback(async (id) => {
    const response = await apiDelete(`${BASE}/suppliers/${id}`);
    if (!response.ok) throw new Error('Failed to delete supplier');
  }, []);

  // Ansprechpartner
  const addAnsprechpartner = useCallback(async (supplierId, data) => {
    const response = await apiPost(`${BASE}/suppliers/${supplierId}/ansprechpartner`, data);
    if (!response.ok) throw new Error('Failed to add contact');
    return (await response.json()).supplier;
  }, []);

  const updateAnsprechpartner = useCallback(async (supplierId, apId, data) => {
    const response = await apiPut(`${BASE}/suppliers/${supplierId}/ansprechpartner/${apId}`, data);
    if (!response.ok) throw new Error('Failed to update contact');
    return (await response.json()).supplier;
  }, []);

  const deleteAnsprechpartner = useCallback(async (supplierId, apId) => {
    const response = await apiDelete(`${BASE}/suppliers/${supplierId}/ansprechpartner/${apId}`);
    if (!response.ok) throw new Error('Failed to delete contact');
    return (await response.json()).supplier;
  }, []);

  // Zertifizierungen
  const addZertifizierung = useCallback(async (supplierId, data) => {
    const response = await apiPost(`${BASE}/suppliers/${supplierId}/zertifizierungen`, data);
    if (!response.ok) throw new Error('Failed to add certification');
    return (await response.json()).supplier;
  }, []);

  const updateZertifizierung = useCallback(async (supplierId, zertId, data) => {
    const response = await apiPut(`${BASE}/suppliers/${supplierId}/zertifizierungen/${zertId}`, data);
    if (!response.ok) throw new Error('Failed to update certification');
    return (await response.json()).supplier;
  }, []);

  const deleteZertifizierung = useCallback(async (supplierId, zertId) => {
    const response = await apiDelete(`${BASE}/suppliers/${supplierId}/zertifizierungen/${zertId}`);
    if (!response.ok) throw new Error('Failed to delete certification');
    return (await response.json()).supplier;
  }, []);

  // Leistungen
  const addLeistung = useCallback(async (supplierId, data) => {
    const response = await apiPost(`${BASE}/suppliers/${supplierId}/leistungen`, data);
    if (!response.ok) throw new Error('Failed to add service');
    return (await response.json()).supplier;
  }, []);

  const updateLeistung = useCallback(async (supplierId, leistId, data) => {
    const response = await apiPut(`${BASE}/suppliers/${supplierId}/leistungen/${leistId}`, data);
    if (!response.ok) throw new Error('Failed to update service');
    return (await response.json()).supplier;
  }, []);

  const deleteLeistung = useCallback(async (supplierId, leistId) => {
    const response = await apiDelete(`${BASE}/suppliers/${supplierId}/leistungen/${leistId}`);
    if (!response.ok) throw new Error('Failed to delete service');
    return (await response.json()).supplier;
  }, []);

  // BIA
  const updateBia = useCallback(async (supplierId, leistId, data) => {
    const response = await apiPut(`${BASE}/suppliers/${supplierId}/leistungen/${leistId}/bia`, data);
    if (!response.ok) throw new Error('Failed to update BIA');
    return (await response.json()).supplier;
  }, []);

  // Regulatorik
  const updateRegulatorik = useCallback(async (supplierId, leistId, data) => {
    const response = await apiPut(`${BASE}/suppliers/${supplierId}/leistungen/${leistId}/regulatorik`, data);
    if (!response.ok) throw new Error('Failed to update regulatorik');
    return (await response.json()).supplier;
  }, []);

  // Lifecycle
  const transitionLifecycle = useCallback(async (supplierId, phase) => {
    const response = await apiPut(`${BASE}/suppliers/${supplierId}/lifecycle/transition`, { phase });
    if (!response.ok) throw new Error('Failed to transition lifecycle');
    return (await response.json()).supplier;
  }, []);

  // Changelog
  const getChangelog = useCallback(async (supplierId, limit = 50, offset = 0) => {
    const response = await apiGet(`${BASE}/suppliers/${supplierId}/changelog?limit=${limit}&offset=${offset}`);
    if (!response.ok) throw new Error('Failed to get changelog');
    return await response.json();
  }, []);

  // Audits
  const getAudits = useCallback(async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.supplier_id) params.set('supplier_id', filters.supplier_id);
    if (filters.status) params.set('status', filters.status);
    const qs = params.toString();
    const response = await apiGet(`${BASE}/audits${qs ? `?${qs}` : ''}`);
    if (!response.ok) throw new Error('Failed to get audits');
    return (await response.json()).audits;
  }, []);

  const createAudit = useCallback(async (data) => {
    const response = await apiPost(`${BASE}/audits`, data);
    if (!response.ok) throw new Error('Failed to create audit');
    return (await response.json()).audit;
  }, []);

  const updateAudit = useCallback(async (auditId, data) => {
    const response = await apiPut(`${BASE}/audits/${auditId}`, data);
    if (!response.ok) throw new Error('Failed to update audit');
    return (await response.json()).audit;
  }, []);

  const deleteAudit = useCallback(async (auditId) => {
    const response = await apiDelete(`${BASE}/audits/${auditId}`);
    if (!response.ok) throw new Error('Failed to delete audit');
  }, []);

  // Audit Plan
  const getAuditPlan = useCallback(async (year) => {
    const response = await apiGet(`${BASE}/audit-plans/${year}`);
    if (!response.ok) return null;
    return (await response.json()).plan;
  }, []);

  const generateAuditPlan = useCallback(async (year) => {
    const response = await apiPost(`${BASE}/audit-plans/${year}/generate`, {});
    if (!response.ok) throw new Error('Failed to generate audit plan');
    return (await response.json()).plan;
  }, []);

  // Documents
  const uploadDokument = useCallback(async (supplierId, file, typ, options = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('typ', typ);
    if (options.referenz_typ) formData.append('referenz_typ', options.referenz_typ);
    if (options.referenz_id) formData.append('referenz_id', options.referenz_id);
    if (options.notizen) formData.append('notizen', options.notizen);
    const response = await apiPostForm(`${BASE}/suppliers/${supplierId}/documents`, formData);
    if (!response.ok) throw new Error('Failed to upload document');
    return (await response.json()).dokument;
  }, []);

  const getDokumente = useCallback(async (supplierId, typ) => {
    const qs = typ ? `?typ=${typ}` : '';
    const response = await apiGet(`${BASE}/suppliers/${supplierId}/documents${qs}`);
    if (!response.ok) throw new Error('Failed to get documents');
    return (await response.json()).dokumente;
  }, []);

  const deleteDokument = useCallback(async (supplierId, docId) => {
    const response = await apiDelete(`${BASE}/suppliers/${supplierId}/documents/${docId}`);
    if (!response.ok) throw new Error('Failed to delete document');
  }, []);

  const downloadDokument = useCallback(async (supplierId, docId) => {
    const response = await apiGet(`${BASE}/suppliers/${supplierId}/documents/${docId}/download`);
    if (!response.ok) throw new Error('Failed to download document');
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?(.+?)"?$/);
    const filename = match ? decodeURIComponent(match[1]) : 'download';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Stats endpoints
  const getRiskDistribution = useCallback(async () => {
    const response = await apiGet(`${BASE}/stats/risk-distribution`);
    if (!response.ok) throw new Error('Failed to get risk distribution');
    return (await response.json()).distribution;
  }, []);

  const getComplianceStats = useCallback(async () => {
    const response = await apiGet(`${BASE}/stats/compliance`);
    if (!response.ok) throw new Error('Failed to get compliance stats');
    return (await response.json()).compliance;
  }, []);

  const getExpiringItems = useCallback(async () => {
    const response = await apiGet(`${BASE}/stats/expiring`);
    if (!response.ok) throw new Error('Failed to get expiring items');
    return (await response.json()).expiring;
  }, []);

  // Initial load
  useEffect(() => {
    fetchConfig();
    fetchSuppliers();
    fetchStats();
  }, [fetchConfig, fetchSuppliers, fetchStats]);

  return {
    suppliers,
    stats,
    config,
    isLoading,
    error,
    refresh: fetchSuppliers,
    refreshStats: fetchStats,
    refreshConfig: fetchConfig,
    createSupplier,
    getSupplier,
    updateSupplier,
    deleteSupplier,
    addAnsprechpartner,
    updateAnsprechpartner,
    deleteAnsprechpartner,
    addZertifizierung,
    updateZertifizierung,
    deleteZertifizierung,
    addLeistung,
    updateLeistung,
    deleteLeistung,
    updateBia,
    updateRegulatorik,
    transitionLifecycle,
    getChangelog,
    getAudits,
    createAudit,
    updateAudit,
    deleteAudit,
    getAuditPlan,
    generateAuditPlan,
    getRiskDistribution,
    getComplianceStats,
    getExpiringItems,
    uploadDokument,
    getDokumente,
    deleteDokument,
    downloadDokument,
  };
}
