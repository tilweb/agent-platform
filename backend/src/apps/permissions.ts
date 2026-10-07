/**
 * App-Berechtigungen — Gruppen-basierte Zugriffskontrolle.
 *
 * 3 Rollen-Stufen pro App: owner > editor > viewer.
 * - Permissions liegen pro App in `registry.yaml.apps[id].permissions.groups[]`.
 * - Aufloesung: User → Gruppen-Mitgliedschaften → Schnittmenge mit App-Permissions
 *   → hoechste Rolle gewinnt.
 * - Globale Admins (`user.role === 'admin'`) haben KEINEN automatischen Zugriff
 *   auf Apps — sie managen die Plattform (Apps an/aus, Gruppen-Permissions
 *   zuweisen via Settings) und sehen Daten nur, wenn sie explizit in einer
 *   berechtigten Gruppe stehen. Plattform-Admin ≠ Daten-Auditor.
 *
 * Phase 1 (jetzt): nur "Zugriff ja/nein" — die Rolle wird trotzdem zurueckgegeben
 * damit Phase 2 (rollen-spezifische In-App-Logik) ohne weiteren Refactor moeglich ist.
 */

import { getApp, loadRegistry, saveRegistry } from './registry';
import { getUserGroups } from '../auth/groups';
import { isAppRole } from './types';
import type { AppRole, AppGroupPermission } from './types';

const ROLE_RANK: Record<AppRole, number> = {
  viewer: 0,
  editor: 1,
  owner: 2,
};

function pickHighest(a: AppRole, b: AppRole): AppRole {
  return ROLE_RANK[a] >= ROLE_RANK[b] ? a : b;
}

/**
 * Effektive App-Rolle eines Users.
 *
 * @returns die Rolle oder `null` wenn der User keinen Zugriff hat.
 */
export async function getUserAppPermission(
  userId: string,
  appId: string,
): Promise<AppRole | null> {
  const registry = await loadRegistry();
  const app = registry.apps[appId];
  if (!app) return null;

  const groupPermissions = app.permissions?.groups ?? [];
  if (groupPermissions.length === 0) return null;

  // User-Gruppen ermitteln
  const userGroups = await getUserGroups(userId);
  const userGroupIds = new Set(userGroups.map((g) => g.id));

  // Schnittmenge: alle App-Permissions die zu einer User-Gruppe passen
  let effectiveRole: AppRole | null = null;
  for (const perm of groupPermissions) {
    if (userGroupIds.has(perm.groupId)) {
      effectiveRole = effectiveRole ? pickHighest(effectiveRole, perm.role) : perm.role;
    }
  }
  return effectiveRole;
}

/**
 * Warum ein Zugriff verweigert wird — steuert die Antwort (HTTP-Status,
 * Frontend-Seite, Werkzeug-Meldung).
 */
export type AppAccessDenial = 'not_found' | 'disabled' | 'unconfigured' | 'no_permission';

export type AppAccess =
  | { allowed: true; role: AppRole }
  | { allowed: false; reason: AppAccessDenial };

/**
 * Zentrale Zugriffspruefung fuer alle Kanaele (App-Routen, Agenten-Werkzeuge,
 * App-Listen): App existiert, ist freigeschaltet (Admin-Schalter UND
 * ENABLED_APPS-Whitelist, beides ueber getApp) und der User hat eine Rolle.
 * Die Public-API prueft Freischaltung + Schluessel-Scope selbst.
 */
export async function resolveAppAccess(userId: string, appId: string): Promise<AppAccess> {
  const app = await getApp(appId);
  if (!app) return { allowed: false, reason: 'not_found' };
  if (!app.enabled) return { allowed: false, reason: 'disabled' };
  if ((app.permissions?.groups ?? []).length === 0) return { allowed: false, reason: 'unconfigured' };
  const role = await getUserAppPermission(userId, appId);
  return role ? { allowed: true, role } : { allowed: false, reason: 'no_permission' };
}

/**
 * Liste aller Gruppen-Permissions auf einer App. Admin-Endpunkt fuer die
 * Settings-UI.
 */
export async function listAppPermissions(appId: string): Promise<AppGroupPermission[]> {
  const registry = await loadRegistry();
  const app = registry.apps[appId];
  if (!app) return [];
  return app.permissions?.groups ?? [];
}

/**
 * Voller Overwrite der Permissions einer App. Admin-Endpunkt — die UI sendet
 * die komplette Liste, wir validieren und ueberschreiben.
 */
export async function replaceAppPermissions(
  appId: string,
  permissions: AppGroupPermission[],
): Promise<AppGroupPermission[]> {
  const registry = await loadRegistry();
  const app = registry.apps[appId];
  if (!app) throw new Error(`App not found: ${appId}`);

  // Deduplicate auf groupId — bei Duplikaten gewinnt der spaeterere Eintrag.
  const dedup = new Map<string, AppGroupPermission>();
  for (const p of permissions) {
    if (!p.groupId || !p.role) continue;
    if (!isAppRole(p.role)) {
      throw new Error(`Invalid role: ${p.role}`);
    }
    dedup.set(p.groupId, { groupId: p.groupId, role: p.role });
  }
  const validated = Array.from(dedup.values());

  app.permissions = { groups: validated };
  await saveRegistry(registry);
  return validated;
}

/**
 * Einzelne Gruppen-Berechtigung entfernen.
 */
export async function removeAppGroupPermission(
  appId: string,
  groupId: string,
): Promise<void> {
  const registry = await loadRegistry();
  const app = registry.apps[appId];
  if (!app) return;
  const current = app.permissions?.groups ?? [];
  const filtered = current.filter((p) => p.groupId !== groupId);
  app.permissions = { groups: filtered };
  await saveRegistry(registry);
}
