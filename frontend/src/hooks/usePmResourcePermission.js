/**
 * Hook fuer Auftrags-/Ideen-Level Rolle des aktuellen Users.
 *
 * Gibt `{ role, loading }` zurueck. Wird in IdeeWizardPage / WizardPage / ProjektePage
 * verwendet, um Save / Delete / Berechtigungen-Aktionen zu gaten.
 *
 * `role`-Werte: `'owner' | 'editor' | 'viewer' | null`. `null` = kein Zugriff.
 *
 * @param {'idee'|'auftrag'} type
 * @param {string|null|undefined} id  Wenn null/undefined, wird kein Request gemacht
 *   und role bleibt `null` (z.B. fuer "neu anlegen"-Pfad ohne id).
 */

import { useEffect, useState } from 'react';
import { apiGet } from '../utils/apiFetch';

export function usePmResourcePermission(type, id) {
  const [state, setState] = useState({ role: null, loading: !!id });

  useEffect(() => {
    if (!id) {
      setState({ role: null, loading: false });
      return;
    }
    let cancelled = false;
    setState({ role: null, loading: true });
    (async () => {
      try {
        const res = await apiGet(`/apps/projektmanagement/my-permission/${type}/${id}`);
        if (cancelled) return;
        if (!res.ok) {
          setState({ role: null, loading: false });
          return;
        }
        const data = await res.json();
        setState({ role: data.role ?? null, loading: false });
      } catch {
        if (!cancelled) setState({ role: null, loading: false });
      }
    })();
    return () => { cancelled = true; };
  }, [type, id]);

  return state;
}

const ROLE_RANK = { viewer: 0, editor: 1, owner: 2 };

/**
 * Helper: hat der User mindestens die geforderte Rolle?
 */
export function hasMinRole(role, required) {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[required];
}
