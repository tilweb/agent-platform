/**
 * useUserPreferences Hook
 *
 * Manages user-specific model preferences via the API.
 * Users can set their preferred models for chat, vision, etc.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut, apiDelete } from '../utils/apiFetch';

const PURPOSES = ['chat', 'vision', 'tts', 'stt', 'text_to_image', 'image_to_image'];

export function useUserPreferences() {
  const [preferences, setPreferences] = useState({});
  const [systemDefaults, setSystemDefaults] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch user preferences and system defaults
  const fetchPreferences = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiGet('/users/preferences/models');

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Modelleinstellungen');
      }

      const data = await response.json();
      setPreferences(data.preferences || {});
      setSystemDefaults(data.systemDefaults || {});
    } catch (err) {
      console.error('Error fetching user preferences:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  /**
   * Set user's preferred model for a specific purpose
   *
   * @param {string} purpose - chat, vision, tts, stt, text_to_image, image_to_image
   * @param {string} providerId - The provider ID
   * @param {string} modelId - The model ID
   */
  const setPreference = useCallback(async (purpose, providerId, modelId) => {
    if (!PURPOSES.includes(purpose)) {
      throw new Error(`Ungültiger Zweck: ${purpose}`);
    }

    try {
      setError(null);

      const response = await apiPut(`/users/preferences/models/${purpose}`, {
        provider_id: providerId,
        model_id: modelId,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Speichern');
      }

      // Update local state
      setPreferences((prev) => ({
        ...prev,
        [purpose]: {
          provider_id: providerId,
          model_id: modelId,
        },
      }));

      return true;
    } catch (err) {
      console.error('Error setting preference:', err);
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Clear user's preference for a purpose (revert to system default)
   *
   * @param {string} purpose - chat, vision, tts, stt, text_to_image, image_to_image
   */
  const clearPreference = useCallback(async (purpose) => {
    if (!PURPOSES.includes(purpose)) {
      throw new Error(`Ungültiger Zweck: ${purpose}`);
    }

    try {
      setError(null);

      const response = await apiDelete(`/users/preferences/models/${purpose}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Zurücksetzen');
      }

      // Update local state - remove the preference
      setPreferences((prev) => {
        const newPrefs = { ...prev };
        delete newPrefs[purpose];
        return newPrefs;
      });

      return true;
    } catch (err) {
      console.error('Error clearing preference:', err);
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Check if user has a custom preference for a purpose
   */
  const hasPreference = useCallback(
    (purpose) => {
      return !!(preferences[purpose]?.provider_id && preferences[purpose]?.model_id);
    },
    [preferences]
  );

  /**
   * Get the effective model for a purpose (user preference or system default)
   */
  const getEffectiveModel = useCallback(
    (purpose) => {
      if (hasPreference(purpose)) {
        return {
          ...preferences[purpose],
          source: 'user',
        };
      }

      if (systemDefaults[purpose]?.provider_id && systemDefaults[purpose]?.model_id) {
        return {
          ...systemDefaults[purpose],
          source: 'system',
        };
      }

      return null;
    },
    [preferences, systemDefaults, hasPreference]
  );

  return {
    // Data
    preferences,
    systemDefaults,
    isLoading,
    error,

    // Actions
    refresh: fetchPreferences,
    setPreference,
    clearPreference,

    // Helpers
    hasPreference,
    getEffectiveModel,
  };
}
