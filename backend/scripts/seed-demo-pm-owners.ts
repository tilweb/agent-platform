/**
 * Seed-Script: andreas_bachmann + ruhrpm als zusaetzliche Owner zu allen
 * existierenden Projektideen + Projektauftraegen hinzufuegen.
 *
 * Wird einmalig aufgerufen — nur fuer aktuelle Demos sinnvoll. Neue Pilot-
 * Installationen sollten das Script NICHT ausfuehren (sonst kommen unerwartete
 * Owner zu allen Eintraegen).
 *
 * Aktiviert per ENV: `SEED_DEMO_OWNERS=true`. Ohne das ENV beendet das Script
 * sofort.
 *
 * Verhalten:
 * - `ownerId`/`created_by` der Idee/Auftrag bleibt unveraendert (Original-Ersteller
 *   ist und bleibt Owner via Default-Owner-Fallback im Permission-Resolver).
 * - andreas_bachmann + ruhrpm werden als zusaetzliche User-Owner-Eintraege
 *   in `permissions.users[]` angehaengt (deduplizierend; existierende Eintraege
 *   bleiben mit ihrer Rolle bestehen).
 *
 * Usage: SEED_DEMO_OWNERS=true /Users/andreasbachmann/.bun/bin/bun run src/../scripts/seed-demo-pm-owners.ts
 */

import { findUserByUsername } from '../src/auth/storage';
import { getProjektideen, updateProjektidee } from '../src/apps/projektmanagement/idee-storage';
import { getProjektauftraege, updateProjektauftrag } from '../src/apps/projektmanagement/storage';
import type { ResourcePermissions, AuftragsRole } from '../src/apps/projektmanagement/types';

const DEMO_OWNER_USERNAMES = ['andreas_bachmann', 'ruhrpm'];

async function main() {
  if (process.env.SEED_DEMO_OWNERS !== 'true') {
    console.log('[seed-demo-pm-owners] SEED_DEMO_OWNERS != "true" — skipping.');
    return;
  }

  console.log('[seed-demo-pm-owners] Resolving demo owner user-ids...');
  const demoOwnerIds: string[] = [];
  for (const username of DEMO_OWNER_USERNAMES) {
    const user = await findUserByUsername(username);
    if (!user) {
      console.warn(`[seed-demo-pm-owners] User "${username}" nicht gefunden — wird uebersprungen.`);
      continue;
    }
    demoOwnerIds.push(user.id);
    console.log(`[seed-demo-pm-owners] ${username} -> ${user.id}`);
  }
  if (demoOwnerIds.length === 0) {
    console.error('[seed-demo-pm-owners] Keine Demo-Owner gefunden — abort.');
    return;
  }

  function mergePermissions(existing: ResourcePermissions | null | undefined): ResourcePermissions {
    const users = existing?.users ?? [];
    const groups = existing?.groups ?? [];
    const userMap = new Map<string, AuftragsRole>(users.map((u) => [u.userId, u.role]));
    for (const ownerId of demoOwnerIds) {
      // Nur hinzufuegen wenn noch nicht da — vorhandene Rolle bleibt erhalten.
      if (!userMap.has(ownerId)) {
        userMap.set(ownerId, 'owner');
      }
    }
    return {
      users: Array.from(userMap.entries()).map(([userId, role]) => ({ userId, role })),
      groups,
    };
  }

  // Falls `created_by === 'user_default'` (Pre-Phase-2-Bug — alle alten Aufraege/Ideen
  // hatten diesen Hardcode-Wert) → setze auf den ersten Demo-Owner um, damit Aufrtraege
  // wieder einen echten Default-Owner haben.
  const fallbackCreatedBy = demoOwnerIds[0];
  function fixCreatedBy(currentCreatedBy: string | undefined | null): string {
    if (!currentCreatedBy || currentCreatedBy === 'user_default') return fallbackCreatedBy!;
    return currentCreatedBy;
  }

  // Ideen
  const ideen = await getProjektideen();
  console.log(`[seed-demo-pm-owners] ${ideen.length} Ideen gefunden.`);
  let ideenUpdated = 0;
  for (const idee of ideen) {
    const newCreatedBy = fixCreatedBy(idee.created_by);
    const merged = mergePermissions(idee.permissions ?? null);
    const permsBefore = JSON.stringify(idee.permissions ?? null);
    const permsAfter = JSON.stringify(merged);
    const createdByChanged = newCreatedBy !== idee.created_by;
    if (permsBefore === permsAfter && !createdByChanged) continue;
    await updateProjektidee(
      idee.id,
      { permissions: merged, created_by: newCreatedBy },
      { force: true },
    );
    ideenUpdated++;
  }

  // Auftraege
  const auftraege = await getProjektauftraege();
  console.log(`[seed-demo-pm-owners] ${auftraege.length} Auftraege gefunden.`);
  let auftraegeUpdated = 0;
  for (const auftrag of auftraege) {
    const newCreatedBy = fixCreatedBy(auftrag.created_by);
    const merged = mergePermissions(auftrag.permissions ?? null);
    const permsBefore = JSON.stringify(auftrag.permissions ?? null);
    const permsAfter = JSON.stringify(merged);
    const createdByChanged = newCreatedBy !== auftrag.created_by;
    if (permsBefore === permsAfter && !createdByChanged) continue;
    await updateProjektauftrag(
      auftrag.id,
      { permissions: merged, created_by: newCreatedBy },
      { force: true },
    );
    auftraegeUpdated++;
  }

  console.log(`[seed-demo-pm-owners] Done. ${ideenUpdated} Ideen + ${auftraegeUpdated} Auftraege aktualisiert.`);
}

main().catch((err) => {
  console.error('[seed-demo-pm-owners] Fatal error:', err);
  process.exit(1);
});
