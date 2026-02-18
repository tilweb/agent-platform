/**
 * useApps Hook
 * Manages apps registry and enabled apps state
 */

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut } from '../utils/apiFetch';

export function useApps() {
  const [apps, setApps] = useState([]);
  const [enabledApps, setEnabledApps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all apps
  const fetchApps = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiGet('/apps');

      if (!response.ok) {
        throw new Error('Failed to fetch apps');
      }

      const data = await response.json();
      const appsList = data.apps || [];

      setApps(appsList);
      setEnabledApps(appsList.filter((app) => app.enabled));
    } catch (err) {
      console.error('Error fetching apps:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  // Enable an app
  const enableApp = useCallback(async (appId) => {
    const response = await apiPut(`/apps/${appId}/enable`, {});

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to enable app');
    }

    const data = await response.json();

    // Update local state
    setApps((prev) =>
      prev.map((app) => (app.id === appId ? { ...app, enabled: true } : app))
    );
    setEnabledApps((prev) => {
      const existing = prev.find((app) => app.id === appId);
      if (existing) {
        return prev.map((app) =>
          app.id === appId ? { ...app, enabled: true } : app
        );
      }
      const appToAdd = apps.find((app) => app.id === appId);
      return appToAdd ? [...prev, { ...appToAdd, enabled: true }] : prev;
    });

    return data.app;
  }, [apps]);

  // Disable an app
  const disableApp = useCallback(async (appId) => {
    const response = await apiPut(`/apps/${appId}/disable`, {});

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to disable app');
    }

    const data = await response.json();

    // Update local state
    setApps((prev) =>
      prev.map((app) => (app.id === appId ? { ...app, enabled: false } : app))
    );
    setEnabledApps((prev) => prev.filter((app) => app.id !== appId));

    return data.app;
  }, []);

  // Toggle app enabled state
  const toggleApp = useCallback(
    async (appId) => {
      const app = apps.find((a) => a.id === appId);
      if (!app) return;

      if (app.enabled) {
        return disableApp(appId);
      } else {
        return enableApp(appId);
      }
    },
    [apps, enableApp, disableApp]
  );

  // Get app by ID
  const getApp = useCallback(
    (appId) => apps.find((app) => app.id === appId) || null,
    [apps]
  );

  return {
    apps,
    enabledApps,
    isLoading,
    error,
    refresh: fetchApps,
    enableApp,
    disableApp,
    toggleApp,
    getApp,
  };
}
