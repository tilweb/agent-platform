/**
 * App-Permission-Middleware.
 *
 * Wird vor App-Endpunkte gehaengt (z.B.
 * `projektmanagement.use('*', requireAppAccess('projektmanagement'))`).
 *
 * Verhalten:
 * - Wenn kein User eingeloggt → 401 (sollte aber nicht passieren — authMiddleware
 *   sollte vorher schon greifen)
 * - Wenn User keine Berechtigung hat (= getUserAppPermission liefert null) → 403
 * - Sonst: setzt `c.set('appRole', role)` damit Phase-2-Code die Rolle verwenden kann
 *
 * Phase 1 prueft nur "Zugriff ja/nein" — die Rolle wird trotzdem im Context
 * abgelegt damit App-Code spaeter editor/viewer/owner unterscheiden kann.
 */

import type { Context, Next } from 'hono';
import { getCurrentUserId } from '../auth/middleware';
import { getUserAppPermission } from './permissions';

export function requireAppAccess(appId: string) {
  return async (c: Context, next: Next) => {
    const userId = getCurrentUserId(c);
    if (!userId) {
      return c.json({ error: 'Nicht eingeloggt' }, 401);
    }
    const role = await getUserAppPermission(userId, appId);
    if (!role) {
      return c.json({ error: 'Keine Berechtigung fuer diese App' }, 403);
    }
    c.set('appRole', role);
    await next();
  };
}
