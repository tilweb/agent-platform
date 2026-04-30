/**
 * useProjektideen Hook
 * CRUD und Auftrag-aus-Idee-Generierung.
 *
 * updateIdee/updateIdeeStep akzeptieren `expectedVersion` und `force`.
 * Bei 409 wird ein VersionConflictError geworfen — die Wizard-Page
 * zeigt das Konflikt-Modal.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/apiFetch';

export class VersionConflictError extends Error {
  constructor(currentServerData) {
    super('version_conflict');
    this.name = 'VersionConflictError';
    this.current = currentServerData;
  }
}

export function useProjektideen({ autoLoad = true } = {}) {
  const [projektideen, setProjektideen] = useState([]);
  const [isLoading, setIsLoading] = useState(autoLoad);
  const [error, setError] = useState(null);

  const fetchIdeen = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiGet('/apps/projektmanagement/projektideen');
      if (!res.ok) throw new Error('Failed to fetch Projektideen');
      const data = await res.json();
      setProjektideen(data.projektideen || []);
    } catch (err) {
      console.error('Error fetching Projektideen:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getIdee = useCallback(async (id) => {
    const res = await apiGet(`/apps/projektmanagement/projektideen/${id}`);
    if (!res.ok) throw new Error('Failed to load Projektidee');
    const data = await res.json();
    return data.projektidee;
  }, []);

  const createIdee = useCallback(async (payload) => {
    const res = await apiPost('/apps/projektmanagement/projektideen', payload);
    if (!res.ok) throw new Error('Failed to create Projektidee');
    const data = await res.json();
    setProjektideen((prev) => [data.projektidee, ...prev]);
    return data.projektidee;
  }, []);

  const updateIdee = useCallback(async (id, payload, { expectedVersion, force = false } = {}) => {
    const body = { ...payload };
    if (expectedVersion !== undefined) body.expected_version = expectedVersion;
    if (force) body.force = true;
    const res = await apiPut(`/apps/projektmanagement/projektideen/${id}`, body);
    if (res.status === 409) {
      const data = await res.json();
      throw new VersionConflictError(data.current);
    }
    if (!res.ok) throw new Error('Failed to update Projektidee');
    const data = await res.json();
    setProjektideen((prev) => prev.map((p) => (p.id === id ? data.projektidee : p)));
    return data.projektidee;
  }, []);

  const updateIdeeStep = useCallback(async (id, step, payload, { expectedVersion, force = false } = {}) => {
    const body = { ...payload };
    if (expectedVersion !== undefined) body.expected_version = expectedVersion;
    if (force) body.force = true;
    const res = await apiPut(`/apps/projektmanagement/projektideen/${id}/step/${step}`, body);
    if (res.status === 409) {
      const data = await res.json();
      throw new VersionConflictError(data.current);
    }
    if (!res.ok) throw new Error('Failed to update Projektidee step');
    const data = await res.json();
    return data.projektidee;
  }, []);

  const deleteIdee = useCallback(async (id) => {
    const res = await apiDelete(`/apps/projektmanagement/projektideen/${id}`);
    if (!res.ok) throw new Error('Failed to delete Projektidee');
    setProjektideen((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const erstelleAuftragAusIdee = useCallback(async (id) => {
    const res = await apiPost(`/apps/projektmanagement/projektideen/${id}/erstelle-auftrag`, {});
    if (!res.ok) throw new Error('Failed to create Auftrag from Idee');
    const data = await res.json();
    return data.projektauftrag;
  }, []);

  useEffect(() => {
    if (autoLoad) fetchIdeen();
  }, [autoLoad, fetchIdeen]);

  return {
    projektideen,
    isLoading,
    error,
    fetchIdeen,
    getIdee,
    createIdee,
    updateIdee,
    updateIdeeStep,
    deleteIdee,
    erstelleAuftragAusIdee,
  };
}
