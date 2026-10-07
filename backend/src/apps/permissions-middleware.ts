/**
 * App-Permission-Middleware.
 *
 * Wird vor App-Endpunkte gehaengt (z.B.
 * `projektmanagement.use('*', requireAppAccess('projektmanagement'))`).
 *
 * Verhalten:
 * - Wenn kein User eingeloggt → 401 (sollte aber nicht passieren — authMiddleware
 *   sollte vorher schon greifen)
 * - Wenn die App nicht freigeschaltet ist (Admin-Schalter oder ENABLED_APPS) → 403
 * - Wenn User keine Berechtigung hat → 403
 * - Sonst: setzt `c.set('appRole', role)` damit Phase-2-Code die Rolle verwenden kann
 *
 * Phase 1 prueft nur "Zugriff ja/nein" — die Rolle wird trotzdem im Context
 * abgelegt damit App-Code spaeter editor/viewer/owner unterscheiden kann.
 */

import type { Context, Next } from 'hono';
import { getCurrentUserId } from '../auth/middleware';
import { resolveAppAccess } from './permissions';

export function requireAppAccess(appId: string) {
  return async (c: Context, next: Next) => {
    const userId = getCurrentUserId(c);
    if (!userId) {
      return c.json({ error: 'Nicht eingeloggt' }, 401);
    }
    const access = await resolveAppAccess(userId, appId);
    if (!access.allowed) {
      if (access.reason === 'not_found' || access.reason === 'disabled') {
        return c.json({ error: 'App ist nicht freigeschaltet', code: 'app_disabled' }, 403);
      }
      return c.json({ error: 'Keine Berechtigung fuer diese App', code: 'no_permission' }, 403);
    }
    c.set('appRole', access.role);
    await next();
  };
}
