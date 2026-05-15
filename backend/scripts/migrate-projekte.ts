/**
 * Migrations-Skript: Projekt-Entity einfuehren (Phase A der PM-Restruktur).
 *
 * Hintergrund: bisher war `paProjektauftraege` de facto das Projekt. Mit
 * Phase A trennen wir Identitaet (Projekt) von Inhalt (Projektauftrag).
 * Beide Tabellen existieren parallel; die IDs werden 1:1 uebernommen,
 * damit alte URLs `/apps/projektmanagement/<id>` weiter funktionieren.
 *
 * Was passiert:
 *   Fuer jeden Eintrag in paProjektauftraege, der NOCH KEIN passendes
 *   paProjekte-Row hat (matching id), wird ein paProjekte-Row erzeugt:
 *     - id           = projektauftrag.id
 *     - name         = projektauftrag.name
 *     - lifecycle    = projektauftrag.status (mapping siehe unten)
 *     - ideeId       = projektauftrag.ideeId
 *     - ownerId      = projektauftrag.ownerId
 *     - portfolioId  = null (Phase D)
 *     - permissions  = projektauftrag.permissions (gespiegelt)
 *     - createdAt/updatedAt = projektauftrag.createdAt/updatedAt
 *
 * Lifecycle-Mapping (Projektauftrag.status → Projekt.lifecycle):
 *   'draft'      → 'planning'
 *   'active'     → 'active'
 *   'completed'  → 'closed'
 *   'cancelled'  → 'cancelled'
 *   sonst        → 'planning' (defensiv)
 *
 * Idempotent: zweite Ausfuehrung ist No-op, weil paProjekte-Rows schon
 * existieren (id-PK-Konflikt wird durch SELECT-existiert-bereits-Check
 * vermieden).
 *
 * Usage:
 *   Lokal:   /Users/andreasbachmann/.bun/bin/bun run backend/scripts/migrate-projekte.ts
 *   Scalingo: scalingo --app workplace-demo run "bun run backend/scripts/migrate-projekte.ts"
 */

import { eq } from 'drizzle-orm';
import { getDb } from '../src/db';
import { paProjekte, paProjektauftraege } from '../src/db/schema/projektmgmt';
import type { ProjektLifecycle } from '../src/apps/projektmanagement/types';

function mapStatusToLifecycle(status: string | null | undefined): ProjektLifecycle {
  switch ((status || '').toLowerCase()) {
    case 'active':
      return 'active';
    case 'completed':
      return 'closed';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'planning';
  }
}

async function main(): Promise<void> {
  const db = getDb();

  console.log('[migrate-projekte] Lade alle Projektauftraege...');
  const auftraege = await db.select().from(paProjektauftraege);
  console.log(`[migrate-projekte] ${auftraege.length} Projektauftrag-Rows gefunden.`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const auftrag of auftraege) {
    try {
      // Existiert schon ein Projekt mit dieser ID?
      const existing = await db
        .select({ id: paProjekte.id })
        .from(paProjekte)
        .where(eq(paProjekte.id, auftrag.id))
        .limit(1);

      if (existing.length > 0) {
        skipped += 1;
        continue;
      }

      const lifecycle = mapStatusToLifecycle(auftrag.status);

      await db.insert(paProjekte).values({
        id: auftrag.id,
        ownerId: auftrag.ownerId,
        name: auftrag.name,
        lifecycle,
        portfolioId: null,
        ideeId: auftrag.ideeId,
        metadata: null,
        permissions: auftrag.permissions as never,
        version: 1,
        createdAt: auftrag.createdAt,
        updatedAt: auftrag.updatedAt,
      });

      created += 1;
    } catch (err: any) {
      errors += 1;
      console.error(`[migrate-projekte] Fehler bei id=${auftrag.id}:`, err?.message || err);
    }
  }

  console.log('[migrate-projekte] Zusammenfassung:');
  console.log(`  Created:  ${created}`);
  console.log(`  Skipped:  ${skipped} (bereits migriert)`);
  console.log(`  Errors:   ${errors}`);
  console.log('[migrate-projekte] Fertig.');
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[migrate-projekte] Fatal:', err);
  process.exit(1);
});
