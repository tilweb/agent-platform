import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../utils/apiFetch';

export function useAgents() {
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState(null); // null = auto-route
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch agents on mount
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setIsLoading(true);
        const response = await apiGet('/agents');

        if (!response.ok) {
          throw new Error('Failed to fetch agents');
        }

        const data = await response.json();
        setAgents(data.agents || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching agents:', err);
        setError(err.message);
        // Set fallback agents for development
        setAgents([
          {
            id: 'general',
            name: 'Allgemeiner Assistent',
            description: 'Hilft bei allgemeinen Aufgaben',
            capabilities: ['Konversation', 'Dateiverwaltung'],
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgents();
  }, []);

  const selectAgent = useCallback((agentId) => {
    setSelectedAgentId(agentId);
  }, []);

  const selectAutoRoute = useCallback(() => {
    setSelectedAgentId(null);
  }, []);

  const getSelectedAgent = useCallback(() => {
    if (!selectedAgentId) return null;
    return agents.find(a => a.id === selectedAgentId) || null;
  }, [selectedAgentId, agents]);

  return {
    agents,
    selectedAgentId,
    selectedAgent: getSelectedAgent(),
    isAutoRoute: selectedAgentId === null,
    isLoading,
    error,
    selectAgent,
    selectAutoRoute,
  };
}
