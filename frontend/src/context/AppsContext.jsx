/**
 * AppsContext
 * Shared context for app registry state so that toggling an app
 * in Settings/AppsPage is immediately reflected in the Sidebar menu.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut } from '../utils/apiFetch';

const AppsContext = createContext(null);

export function AppsProvider({ children }) {
  const [apps, setApps] = useState([]);
  const [enabledApps, setEnabledApps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const enableApp = useCallback(async (appId) => {
    const response = await apiPut(`/apps/${appId}/enable`, {});

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to enable app');
    }

    const data = await response.json();

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

  const disableApp = useCallback(async (appId) => {
    const response = await apiPut(`/apps/${appId}/disable`, {});

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to disable app');
    }

    const data = await response.json();

    setApps((prev) =>
      prev.map((app) => (app.id === appId ? { ...app, enabled: false } : app))
    );
    setEnabledApps((prev) => prev.filter((app) => app.id !== appId));

    return data.app;
  }, []);

  const reorderApps = useCallback(async (appIds) => {
    const response = await apiPut('/apps/order', { appIds });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to reorder apps');
    }

    const data = await response.json();
    const reorderedApps = data.apps || [];

    setApps(reorderedApps);
    setEnabledApps(reorderedApps.filter((app) => app.enabled));

    return reorderedApps;
  }, []);

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

  const getApp = useCallback(
    (appId) => apps.find((app) => app.id === appId) || null,
    [apps]
  );

  return (
    <AppsContext.Provider
      value={{
        apps,
        enabledApps,
        isLoading,
        error,
        refresh: fetchApps,
        enableApp,
        disableApp,
        toggleApp,
        reorderApps,
        getApp,
      }}
    >
      {children}
    </AppsContext.Provider>
  );
}

export function useApps() {
  const context = useContext(AppsContext);
  if (!context) {
    throw new Error('useApps must be used within an AppsProvider');
  }
  return context;
}
