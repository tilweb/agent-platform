/**
 * useFavoriteAgents
 *
 * Lädt und speichert die Favoriten-Agenten des Nutzers (Agent-IDs) für die
 * Schnellauswahl in der Chat-Sidebar. Persistenz über die User-Preferences.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut } from '../utils/apiFetch';

export function useFavoriteAgents() {
  const [favoriteAgentIds, setFavoriteAgentIds] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await apiGet('/users/preferences/favorite-agents');
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setFavoriteAgentIds(data.agent_ids || []);
      } catch (err) {
        console.error('Error loading favorite agents:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const saveFavoriteAgents = useCallback(async (agentIds) => {
    const response = await apiPut('/users/preferences/favorite-agents', { agent_ids: agentIds });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Fehler beim Speichern der Favoriten');
    }
    const data = await response.json();
    setFavoriteAgentIds(data.agent_ids || []);
  }, []);

  return { favoriteAgentIds, saveFavoriteAgents };
}
