/**
 * RequireAppPermission — Wrapper fuer alle App-Pages.
 *
 * Beim Mount: GET /api/apps/:appId/my-permission.
 * - role !== null               → Children rendern, AppPermissionContext stellt Rolle bereit
 * - role === null + configured  → "Keine Berechtigung"-Page
 * - role === null + !configured → "Wartet auf Konfiguration"-Page (Admin sieht Direkt-Link zu Settings)
 *
 * Globale Admins bekommen serverseitig automatisch role='owner' — sehen also
 * jede App.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { apiGet } from '../utils/apiFetch';
import { theme } from '../config/theme';
import NotAuthorizedPage from './AppPermissionPages/NotAuthorizedPage';
import WaitingForConfigurationPage from './AppPermissionPages/WaitingForConfigurationPage';

const AppPermissionContext = createContext({ role: null, appId: null });

export function useAppPermission() {
  return useContext(AppPermissionContext);
}

const styles = {
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: '300px',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
};

export default function RequireAppPermission({ appId, children }) {
  const [state, setState] = useState({ status: 'loading', role: null, configured: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet(`/apps/${appId}/my-permission`);
        if (cancelled) return;
        if (!res.ok) {
          setState({ status: 'denied', role: null, configured: false });
          return;
        }
        const data = await res.json();
        setState({
          status: data.role ? 'allowed' : (data.configured ? 'denied' : 'unconfigured'),
          role: data.role,
          configured: !!data.configured,
        });
      } catch {
        if (!cancelled) setState({ status: 'denied', role: null, configured: false });
      }
    })();
    return () => { cancelled = true; };
  }, [appId]);

  if (state.status === 'loading') {
    return <div style={styles.loading}>Lade…</div>;
  }
  if (state.status === 'unconfigured') {
    return <WaitingForConfigurationPage appId={appId} />;
  }
  if (state.status === 'denied') {
    return <NotAuthorizedPage appId={appId} />;
  }
  return (
    <AppPermissionContext.Provider value={{ role: state.role, appId }}>
      {children}
    </AppPermissionContext.Provider>
  );
}
