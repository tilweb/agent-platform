/**
 * Phase-2 Auftrags-/Idee-Level Berechtigungen fuer das Projektmanagement.
 *
 * Zwei-Ebenen-Modell mit MAX-Verschmelzung (Slack/GitHub-Style):
 * - **App-Level** (siehe `apps/permissions.ts`): wer hat ueberhaupt Zugriff
 *   auf die App `projektmanagement` und welche App-Rolle (owner/editor/viewer).
 *   Diese Rolle ist der **Floor** auf allen Ressourcen der App.
 * - **Resource-Level** (hier): wer hat welche Rolle auf einer konkreten
 *   Idee/Auftrag. Statusberichte/LL/Abschluss erben vom Auftrag.
 *
 * Effektive Rolle = MAX(App-Rolle, Resource-Rolle).
 *
 *   App-Owner-Gruppe (PMO/Fuehrung) sieht und bearbeitet **alle** Auftraege
 *   der App, auch ohne explizite Auftrags-Permissions.
 *   App-Editor sieht alles + kann editieren.
 *   App-Viewer sieht alles read-only.
 *
 * Default ohne explizite Auftrags-Permissions: Ersteller (`ownerId` /
 * `created_by`) ist Owner. Bleibt Owner auch wenn er spaeter keine App-
 * Berechtigung mehr hat — sonst koennten Eintraege verwaisen.
 */

import { getProjektidee, updateProjektidee } from './idee-storage';
import { getProjektauftrag, updateProjektauftrag } from './storage';
import { getUserGroups } from '../../auth/groups';
import { getUserAppPermission } from '../permissions';
import type { AppRole } from '../types';
import type {
  AuftragsRole,
  ResourcePermissions,
  Projektidee,
  Projektauftrag,
} from './types';

const APP_ID = 'projektmanagement';

const ROLE_RANK: Record<AuftragsRole, number> = {
  viewer: 0,
  editor: 1,
  owner: 2,
};

function pickHighest(a: AuftragsRole | null, b: AuftragsRole | null): AuftragsRole | null {
  if (!a) return b;
  if (!b) return a;
  return ROLE_RANK[a] >= ROLE_RANK[b] ? a : b;
}

/**
 * Default-Permissions fuer neu erzeugte Ressourcen (Idee/Auftrag/Projekt):
 * Ersteller ist explizit Owner. Sichergestellt dass `permissions` nie null
 * bleibt — dann reicht keine Resync/Migration mehr fuer Sichtbarkeitsausfall.
 *
 * `created_by`-Fallback im Resolver bleibt als Backstop fuer Legacy-Daten;
 * fuer alles ab dieser Aenderung gilt: Permissions sind die source of truth.
 */
export function defaultOwnerPermissions(userId: string): ResourcePermissions {
  return {
    users: [{ userId, role: 'owner' }],
    groups: [],
  };
}

/**
 * Synchroner Resolver — sowohl fuer Idee als auch Auftrag identisch:
 * Resource-Rolle + App-Rolle (Floor) gehen mit MAX zusammen.
 *
 * - `ownerId` = Ersteller; gibt Owner unabhaengig von der App-Rolle
 * - `permissions.users[]` / `permissions.groups[]` = Resource-Overrides
 * - `appRole` (PMO-Gruppe) = Floor auf alle Ressourcen der App
 */
export function resolveRole(
  userId: string,
  ownerId: string | null | undefined,
  permissions: ResourcePermissions | null | undefined,
  userGroupIds: Set<string>,
  appRole: AppRole | null | undefined,
): AuftragsRole | null {
  let role: AuftragsRole | null = null;

  // 1. Ersteller ist immer Owner — bleibt auch wenn App-Berechtigung
  //    spaeter weggenommen wird (sonst verwaisen Eintraege).
  if (ownerId && ownerId === userId) {
    role = 'owner';
  }

  // 2. Resource-Level Permissions
  if (permissions) {
    for (const perm of permissions.users ?? []) {
      if (perm.userId === userId) {
        role = pickHighest(role, perm.role);
      }
    }
    for (const perm of permissions.groups ?? []) {
      if (userGroupIds.has(perm.groupId)) {
        role = pickHighest(role, perm.role);
      }
    }
  }

  // 3. App-Rolle als Floor (Slack/GitHub-Modell)
  if (appRole) {
    role = pickHighest(role, appRole as AuftragsRole);
  }

  return role;
}

async function getUserGroupIds(userId: string): Promise<Set<string>> {
  const groups = await getUserGroups(userId);
  return new Set(groups.map((g) => g.id));
}

/**
 * Effektive Rolle eines Users auf einer Idee. `null` = kein Zugriff.
 */
export async function getEffectiveIdeeRole(
  userId: string,
  ideeId: string,
): Promise<AuftragsRole | null> {
  const idee = await getProjektidee(ideeId);
  if (!idee) return null;
  const [userGroupIds, appRole] = await Promise.all([
    getUserGroupIds(userId),
    getUserAppPermission(userId, APP_ID),
  ]);
  return resolveRole(
    userId,
    (idee as Projektidee & { ownerId?: string }).ownerId ?? idee.created_by,
    idee.permissions ?? null,
    userGroupIds,
    appRole,
  );
}

/**
 * Effektive Rolle eines Users auf einem Auftrag. `null` = kein Zugriff.
 */
export async function getEffectiveAuftragRole(
  userId: string,
  auftragId: string,
): Promise<AuftragsRole | null> {
  const auftrag = await getProjektauftrag(auftragId);
  if (!auftrag) return null;
  const [userGroupIds, appRole] = await Promise.all([
    getUserGroupIds(userId),
    getUserAppPermission(userId, APP_ID),
  ]);
  return resolveRole(
    userId,
    (auftrag as Projektauftrag & { ownerId?: string }).ownerId ?? auftrag.created_by,
    auftrag.permissions ?? null,
    userGroupIds,
    appRole,
  );
}

/**
 * Permissions-Validierung — wirft bei ungueltiger Struktur.
 */
function validatePermissions(input: unknown): ResourcePermissions {
  if (!input || typeof input !== 'object') {
    throw new Error('Permissions muessen ein Objekt mit users[] und groups[] sein.');
  }
  const obj = input as { users?: unknown; groups?: unknown };
  const users = Array.isArray(obj.users) ? obj.users : [];
  const groups = Array.isArray(obj.groups) ? obj.groups : [];
  const validRoles: AuftragsRole[] = ['owner', 'editor', 'viewer'];

  // Dedup auf userId/groupId — bei Duplikaten gewinnt der spaeterere Eintrag.
  const userMap = new Map<string, AuftragsRole>();
  for (const u of users) {
    const e = u as { userId?: string; role?: AuftragsRole };
    if (!e.userId || !e.role || !validRoles.includes(e.role)) continue;
    userMap.set(e.userId, e.role);
  }
  const groupMap = new Map<string, AuftragsRole>();
  for (const g of groups) {
    const e = g as { groupId?: string; role?: AuftragsRole };
    if (!e.groupId || !e.role || !validRoles.includes(e.role)) continue;
    groupMap.set(e.groupId, e.role);
  }

  return {
    users: Array.from(userMap.entries()).map(([userId, role]) => ({ userId, role })),
    groups: Array.from(groupMap.entries()).map(([groupId, role]) => ({ groupId, role })),
  };
}

/**
 * Permissions einer Idee ueberschreiben. Nur Auftrags-Owner darf.
 */
export async function replaceIdeePermissions(
  ideeId: string,
  rawPermissions: unknown,
  requesterUserId: string,
): Promise<ResourcePermissions> {
  const role = await getEffectiveIdeeRole(requesterUserId, ideeId);
  if (role !== 'owner') {
    throw new Error('Nur Owner darf Berechtigungen aendern.');
  }
  const validated = validatePermissions(rawPermissions);
  // updateProjektidee mit force=true — wir umgehen den Concurrency-Check
  // weil Permission-Aenderungen vom restlichen Inhalt entkoppelt sind.
  await updateProjektidee(ideeId, { permissions: validated }, { force: true });
  return validated;
}

/**
 * Permissions eines Auftrags ueberschreiben. Nur Auftrags-Owner darf.
 */
export async function replaceAuftragPermissions(
  auftragId: string,
  rawPermissions: unknown,
  requesterUserId: string,
): Promise<ResourcePermissions> {
  const role = await getEffectiveAuftragRole(requesterUserId, auftragId);
  if (role !== 'owner') {
    throw new Error('Nur Owner darf Berechtigungen aendern.');
  }
  const validated = validatePermissions(rawPermissions);
  await updateProjektauftrag(auftragId, { permissions: validated }, { force: true });
  return validated;
}

/**
 * Listen-Filter — gibt alle IDs zurueck auf die der User Zugriff hat
 * (mindestens viewer-Rolle). Wird in den GET-Listen-Endpoints verwendet.
 */
export async function listAccessibleIdeeIds(
  userId: string,
  allIdeen: Projektidee[],
): Promise<Map<string, AuftragsRole>> {
  const [userGroupIds, appRole] = await Promise.all([
    getUserGroupIds(userId),
    getUserAppPermission(userId, APP_ID),
  ]);
  const result = new Map<string, AuftragsRole>();
  for (const idee of allIdeen) {
    const role = resolveRole(
      userId,
      (idee as Projektidee & { ownerId?: string }).ownerId ?? idee.created_by,
      idee.permissions ?? null,
      userGroupIds,
      appRole,
    );
    if (role) result.set(idee.id, role);
  }
  return result;
}

export async function listAccessibleAuftragIds(
  userId: string,
  allAuftraege: Projektauftrag[],
): Promise<Map<string, AuftragsRole>> {
  const [userGroupIds, appRole] = await Promise.all([
    getUserGroupIds(userId),
    getUserAppPermission(userId, APP_ID),
  ]);
  const result = new Map<string, AuftragsRole>();
  for (const auftrag of allAuftraege) {
    const role = resolveRole(
      userId,
      (auftrag as Projektauftrag & { ownerId?: string }).ownerId ?? auftrag.created_by,
      auftrag.permissions ?? null,
      userGroupIds,
      appRole,
    );
    if (role) result.set(auftrag.id, role);
  }
  return result;
}

/**
 * Helper fuer Endpoint-Guards. Wirft `'forbidden'` als Error wenn die Rolle
 * nicht ausreicht. Caller handhabt das als 403.
 */
export function assertMinimumRole(
  effectiveRole: AuftragsRole | null,
  required: AuftragsRole,
): void {
  if (!effectiveRole) {
    const err = new Error('Keine Berechtigung fuer diese Resource.');
    (err as Error & { code?: string }).code = 'forbidden';
    throw err;
  }
  if (ROLE_RANK[effectiveRole] < ROLE_RANK[required]) {
    const err = new Error(`Berechtigung unzureichend: ${effectiveRole} (mind. ${required} noetig).`);
    (err as Error & { code?: string }).code = 'forbidden';
    throw err;
  }
}
