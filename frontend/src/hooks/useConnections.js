import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/apiFetch';

export function useConnections() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await apiGet('/connections');

      if (!res.ok) {
        throw new Error('Failed to fetch connections');
      }

      const data = await res.json();
      setProviders(data.providers || []);
    } catch (err) {
      setError(err.message);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const connect = useCallback(async (providerId) => {
    try {
      const res = await apiGet(`/connections/${providerId}/connect`);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start connection');
      }

      const { authUrl } = await res.json();

      // Open popup for OAuth
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'oauth_popup',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Browser blocked the popup
      if (!popup) {
        throw new Error('Popup wurde vom Browser blockiert. Bitte erlaube Popups für diese Seite.');
      }

      // Wait for popup to complete
      return new Promise((resolve, reject) => {
        const handleMessage = (event) => {
          if (event.data?.type === 'oauth_callback') {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);

            if (event.data.success) {
              fetchProviders();
              resolve({ success: true });
            } else {
              reject(new Error(event.data.message || 'OAuth failed'));
            }
          }
        };

        window.addEventListener('message', handleMessage);

        // Check if popup was closed without completing
        const checkClosed = setInterval(() => {
          if (!popup || popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);
            // Don't reject - user may have cancelled intentionally
            resolve({ cancelled: true });
          }
        }, 500);
      });
    } catch (err) {
      throw err;
    }
  }, [fetchProviders]);

  const disconnect = useCallback(async (providerId) => {
    try {
      const res = await apiPost(`/connections/${providerId}/disconnect`);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to disconnect');
      }

      await fetchProviders();
      return { success: true };
    } catch (err) {
      throw err;
    }
  }, [fetchProviders]);

  const checkStatus = useCallback(async (providerId) => {
    try {
      const res = await apiGet(`/connections/${providerId}/status`);

      if (!res.ok) {
        throw new Error('Failed to check status');
      }

      return await res.json();
    } catch (err) {
      throw err;
    }
  }, []);

  const loadConfig = useCallback(async (pluginId) => {
    try {
      const res = await apiGet(`/plugins/${pluginId}/config`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load config');
      }
      return await res.json();
    } catch (err) {
      throw err;
    }
  }, []);

  const saveConfig = useCallback(async (pluginId, values) => {
    try {
      const res = await apiPut(`/plugins/${pluginId}/config`, { values });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save config');
      }
      await fetchProviders();
      return await res.json();
    } catch (err) {
      throw err;
    }
  }, [fetchProviders]);

  const deleteConfig = useCallback(async (pluginId) => {
    try {
      const res = await apiDelete(`/plugins/${pluginId}/config`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete config');
      }
      await fetchProviders();
      return await res.json();
    } catch (err) {
      throw err;
    }
  }, [fetchProviders]);

  const toggleEnabled = useCallback(async (pluginId, enabled) => {
    try {
      const endpoint = enabled ? 'enable' : 'disable';
      const res = await apiPost(`/plugins/${pluginId}/${endpoint}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to toggle plugin');
      }
      await fetchProviders();
    } catch (err) {
      throw err;
    }
  }, [fetchProviders]);

  return {
    providers,
    loading,
    error,
    refresh: fetchProviders,
    connect,
    disconnect,
    checkStatus,
    loadConfig,
    saveConfig,
    deleteConfig,
    toggleEnabled,
  };
}
