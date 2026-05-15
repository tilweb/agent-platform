/**
 * Migrations-Skript: Projekt-Entity einfuehren (Phase A der PM-Restruktur,
 * demo/messe / YAML-Variante).
 *
 * Hintergrund: bisher war `projektauftraege/{id}/metadata.yaml` de facto das
 * Projekt. Mit Phase A trennen wir Identitaet (Projekt) von Inhalt (Auftrag).
 * Beide YAML-Strukturen existieren parallel; die IDs werden 1:1 uebernommen,
 * damit alte URLs `/apps/projektmanagement/<id>` weiter funktionieren.
 *
 * Was passiert:
 *   Fuer jeden Eintrag in data/apps/projektmanagement/projektauftraege/, der
 *   NOCH KEIN passendes data/.../projekte/{id}/metadata.yaml hat, wird ein
 *   projekt-Row als YAML angelegt:
 *     - id            = projektauftrag.id
 *     - name          = projektauftrag.name
 *     - lifecycle     = projektauftrag.status (mapping siehe unten)
 *     - ideeId        = projektauftrag.idee_id
 *     - ownerId       = projektauftrag.created_by (Owner-Approximation)
 *     - portfolioId   = null (Phase D)
 *     - permissions   = projektauftrag.permissions (gespiegelt)
 *     - createdAt/updatedAt = projektauftrag.created_at/updated_at
 *
 * Lifecycle-Mapping (Projektauftrag.status → Projekt.lifecycle):
 *   'draft'      → 'planning'
 *   'active'     → 'active'
 *   'completed'  → 'closed'
 *   'cancelled'  → 'cancelled'
 *   sonst        → 'planning' (defensiv)
 *
 * Idempotent: zweite Ausfuehrung ist No-op, weil projekte/{id}/metadata.yaml
 * schon existiert.
 *
 * Usage:
 *   /Users/andreasbachmann/.bun/bin/bun run backend/scripts/migrate-projekte.ts
 */

import { parse, stringify } from 'yaml';
import type { Projekt, ProjektLifecycle, Projektauftrag } from '../src/apps/projektmanagement/types';

const BASE = './data/apps/projektmanagement';
const AUFTRAEGE = `${BASE}/projektauftraege`;
const PROJEKTE = `${BASE}/projekte`;

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
  await Bun.$`mkdir -p ${PROJEKTE}`;

  console.log('[migrate-projekte] Scanne Projektauftraege...');
  const ids: string[] = [];
  try {
    const glob = new Bun.Glob('*/metadata.yaml');
    for await (const path of glob.scan(AUFTRAEGE)) {
      const id = path.split('/')[0];
      if (id) ids.push(id);
    }
  } catch {
    // projektauftraege/ existiert noch nicht — kein Migrations-Bedarf.
  }
  console.log(`[migrate-projekte] ${ids.length} Auftrag-Verzeichnisse gefunden.`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const id of ids) {
    try {
      const existing = Bun.file(`${PROJEKTE}/${id}/metadata.yaml`);
      if (await existing.exists()) {
        skipped += 1;
        continue;
      }

      const auftragFile = Bun.file(`${AUFTRAEGE}/${id}/metadata.yaml`);
      if (!(await auftragFile.exists())) {
        skipped += 1;
        continue;
      }
      const auftrag = parse(await auftragFile.text()) as Projektauftrag;

      const lifecycle = mapStatusToLifecycle(auftrag.status);
      const now = new Date().toISOString();
      const projekt: Projekt = {
        id: auftrag.id,
        name: auftrag.name,
        lifecycle,
        portfolioId: undefined,
        ideeId: auftrag.idee_id ?? undefined,
        ownerId: auftrag.created_by ?? undefined,
        metadata: undefined,
        permissions: auftrag.permissions ?? undefined,
        version: 1,
        createdAt: auftrag.created_at ?? now,
        updatedAt: auftrag.updated_at ?? now,
      };

      await Bun.$`mkdir -p ${PROJEKTE}/${id}`;
      await Bun.write(`${PROJEKTE}/${id}/metadata.yaml`, stringify(projekt));
      created += 1;
    } catch (err: any) {
      errors += 1;
      console.error(`[migrate-projekte] Fehler bei id=${id}:`, err?.message || err);
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
