/**
 * useUserMemory Hook (v2)
 *
 * Custom hook for managing user memory data via API.
 * Sections: about, instructions, context
 */

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/apiFetch';

export function useUserMemory() {
  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load all memory data
  const loadMemory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiGet('/memory');
      if (!response.ok) {
        throw new Error('Failed to load memory');
      }
      const data = await response.json();
      setMemory(data);
    } catch (err) {
      setError(err.message);
      console.error('Error loading memory:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadMemory();
  }, [loadMemory]);

  // Add about item
  const addAbout = useCallback(async (content) => {
    try {
      const response = await apiPost('/memory/about', { content, source: 'manual' });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add item');
      }

      const item = await response.json();

      setMemory(prev => ({
        ...prev,
        about: [...(prev.about || []), item],
      }));

      return item;
    } catch (err) {
      console.error('Error adding about item:', err);
      throw err;
    }
  }, []);

  // Add instruction
  const addInstruction = useCallback(async (content, priority = 'normal') => {
    try {
      const response = await apiPost('/memory/instructions', { content, priority, source: 'manual' });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add instruction');
      }

      const item = await response.json();

      setMemory(prev => ({
        ...prev,
        instructions: [...(prev.instructions || []), item],
      }));

      return item;
    } catch (err) {
      console.error('Error adding instruction:', err);
      throw err;
    }
  }, []);

  // Add context item
  const addContext = useCallback(async (name, description = '', active = true) => {
    try {
      const response = await apiPost('/memory/context', { name, description, active, source: 'manual' });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add context');
      }

      const item = await response.json();

      setMemory(prev => ({
        ...prev,
        context: [...(prev.context || []), item],
      }));

      return item;
    } catch (err) {
      console.error('Error adding context:', err);
      throw err;
    }
  }, []);

  // Toggle context active status
  const setContextActive = useCallback(async (itemId, active) => {
    try {
      const response = await apiPut(`/memory/context/${itemId}/active`, { active });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update context');
      }

      setMemory(prev => ({
        ...prev,
        context: prev.context.map(item =>
          item.id === itemId ? { ...item, active } : item
        ),
      }));

      return true;
    } catch (err) {
      console.error('Error updating context:', err);
      throw err;
    }
  }, []);

  // Delete item from any section
  const deleteItem = useCallback(async (section, itemId) => {
    try {
      const response = await apiDelete(`/memory/${section}/${itemId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete item');
      }

      setMemory(prev => ({
        ...prev,
        [section]: prev[section].filter(item => item.id !== itemId),
      }));

      return true;
    } catch (err) {
      console.error('Error deleting item:', err);
      throw err;
    }
  }, []);

  // Update settings
  const updateSettings = useCallback(async (updates) => {
    try {
      const response = await apiPut('/memory/settings', updates);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update settings');
      }

      const settings = await response.json();

      setMemory(prev => ({
        ...prev,
        settings,
      }));

      return settings;
    } catch (err) {
      console.error('Error updating settings:', err);
      throw err;
    }
  }, []);

  // Calculate stats
  const stats = memory ? {
    about: memory.about?.length || 0,
    instructions: memory.instructions?.length || 0,
    context: memory.context?.length || 0,
    activeContext: memory.context?.filter(c => c.active)?.length || 0,
    total: (memory.about?.length || 0) + (memory.instructions?.length || 0) + (memory.context?.length || 0),
  } : null;

  return {
    memory,
    loading,
    error,
    stats,
    refresh: loadMemory,
    addAbout,
    addInstruction,
    addContext,
    setContextActive,
    deleteItem,
    updateSettings,
  };
}
