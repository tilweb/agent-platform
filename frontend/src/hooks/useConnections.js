import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function useConnections({ admin = false } = {}) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Admin-Modus: vollstaendige Provider-Liste inkl. Freischalt-Status.
      // User-Modus: nur fuer User freigeschaltete Provider (Backend-Filter).
      const path = admin ? '/connections/admin/providers' : '/connections';
      const res = await fetch(`${API_BASE}${path}`, {
        credentials: 'include',
      });

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
  }, [admin]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const connect = useCallback(async (providerId) => {
    try {
      const res = await fetch(`${API_BASE}/connections/${providerId}/connect`, {
        credentials: 'include',
      });

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

      // Wait for popup to complete
      return new Promise((resolve, reject) => {
        const handleMessage = (event) => {
          if (event.data?.type === 'oauth_callback') {
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
          if (popup.closed) {
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

  // Connect via Client-Credentials / API-Key (kein OAuth-Popup, sondern
  // ein Modal mit Eingabefeldern). `input` ist ein {key: value}-Objekt
  // gemaess provider.credentialFields.
  const connectWithCredentials = useCallback(async (providerId, input) => {
    const res = await fetch(`${API_BASE}/connections/${providerId}/credentials`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input || {}),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Connection failed');
    }
    await fetchProviders();
    return data;
  }, [fetchProviders]);

  const disconnect = useCallback(async (providerId) => {
    try {
      const res = await fetch(`${API_BASE}/connections/${providerId}/disconnect`, {
        method: 'POST',
        credentials: 'include',
      });

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
      const res = await fetch(`${API_BASE}/connections/${providerId}/status`, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to check status');
      }

      return await res.json();
    } catch (err) {
      throw err;
    }
  }, []);

  // Admin: Provider fuer User freischalten/sperren.
  const setProviderEnabled = useCallback(async (providerId, enabled) => {
    const res = await fetch(`${API_BASE}/connections/admin/providers/${providerId}/enabled`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update provider');
    }
    await fetchProviders();
    return data;
  }, [fetchProviders]);

  return {
    providers,
    loading,
    error,
    refresh: fetchProviders,
    connect,
    connectWithCredentials,
    disconnect,
    checkStatus,
    setProviderEnabled,
  };
}
