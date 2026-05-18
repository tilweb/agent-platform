/**
 * Gemeinsame Helpers fuer die aufgesplitteten Route-Module.
 *
 * Wird sowohl von `routes.ts` (Legacy, noch nicht migrierte Endpoints) als
 * auch von `routes/projekte.ts`, `routes/lessons-learned.ts`,
 * `routes/abschluss.ts` benutzt.
 *
 * Wenn der Route-Split spaeter weitergeht (Auftrag/SB/Idee/etc.), bleibt
 * dieses File die zentrale Stelle fuer Berechtigungs-Gates.
 */

import type { Context } from 'hono';
import type { AuftragsRole } from '../types';
import { getEffectiveAuftragRole, getEffectiveIdeeRole } from '../permissions';

export const ROLE_RANK: Record<AuftragsRole, number> = { viewer: 0, editor: 1, owner: 2 };

/**
 * App-Level Editor- oder Owner-Rolle erforderlich (z.B. fuer "Neu anlegen").
 * `requireAppAccess` hat appRole bereits in den Context gesetzt.
 */
export function denyIfNotAppEditor(c: Context): { error: string } | null {
  const appRole = c.get('appRole') as AuftragsRole | undefined;
  if (appRole !== 'owner' && appRole !== 'editor') {
    return { error: 'App-Editor- oder -Owner-Rolle erforderlich.' };
  }
  return null;
}

/**
 * App-Level Owner-Rolle erforderlich (z.B. fuer App-Settings).
 */
export function denyIfNotAppOwner(c: Context): { error: string } | null {
  const appRole = c.get('appRole') as AuftragsRole | undefined;
  if (appRole !== 'owner') {
    return { error: 'App-Owner-Rolle erforderlich.' };
  }
  return null;
}

/**
 * Auftrags-/Idee-Level: User muss mindestens `required` auf der konkreten
 * Resource haben. Liefert `null` bei OK, sonst ein Error-Payload (403).
 */
export async function denyIfBelowIdeeRole(
  userId: string,
  ideeId: string,
  required: AuftragsRole,
): Promise<{ error: string; status: 403 | 404 } | null> {
  const role = await getEffectiveIdeeRole(userId, ideeId);
  if (!role) {
    return { error: 'Keine Berechtigung fuer diese Idee.', status: 403 };
  }
  if (ROLE_RANK[role] < ROLE_RANK[required]) {
    return { error: `Berechtigung unzureichend: ${role} (mind. ${required} noetig).`, status: 403 };
  }
  return null;
}

export async function denyIfBelowAuftragRole(
  userId: string,
  auftragId: string,
  required: AuftragsRole,
): Promise<{ error: string; status: 403 | 404 } | null> {
  const role = await getEffectiveAuftragRole(userId, auftragId);
  if (!role) {
    return { error: 'Keine Berechtigung fuer diesen Auftrag.', status: 403 };
  }
  if (ROLE_RANK[role] < ROLE_RANK[required]) {
    return { error: `Berechtigung unzureichend: ${role} (mind. ${required} noetig).`, status: 403 };
  }
  return null;
}
