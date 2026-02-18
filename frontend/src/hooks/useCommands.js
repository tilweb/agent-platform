import { useState, useCallback } from 'react';
import { apiGet, apiPost } from '../utils/apiFetch';

/**
 * Hook for fetching and executing slash commands
 */
export function useCommands() {
  const [commands, setCommands] = useState([]);
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch all available commands
   */
  const fetchCommands = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiGet('/commands');
      if (!response.ok) {
        throw new Error('Failed to fetch commands');
      }
      const data = await response.json();
      setCommands(data.commands || []);
      return data.commands || [];
    } catch (err) {
      console.error('Error fetching commands:', err);
      setError(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetch options for a specific command
   */
  const fetchOptions = useCallback(async (commandId) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiGet(`/commands/${commandId}/options`);
      if (!response.ok) {
        throw new Error('Failed to fetch options');
      }
      const data = await response.json();
      setOptions(data.options || []);
      return data.options || [];
    } catch (err) {
      console.error('Error fetching options:', err);
      setError(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Execute a command
   */
  const executeCommand = useCallback(async (command, optionId, args) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiPost('/commands/execute', {
        command,
        optionId,
        args,
      });

      const result = await response.json();
      return result;
    } catch (err) {
      console.error('Error executing command:', err);
      setError(err.message);
      return {
        success: false,
        message: err.message,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clear options (when going back to command list)
   */
  const clearOptions = useCallback(() => {
    setOptions([]);
  }, []);

  return {
    commands,
    options,
    isLoading,
    error,
    fetchCommands,
    fetchOptions,
    executeCommand,
    clearOptions,
  };
}
