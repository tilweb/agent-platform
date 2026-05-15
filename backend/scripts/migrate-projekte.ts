/**
 * CLI-Wrapper um `migrateAuftraegeToProjekteIfNeeded()` (YAML-Variante).
 *
 * Auf Railway wird dieses Script vom Dockerfile-CMD beim Boot aufgerufen
 * (nach den Seed-Scripten, vor dem Server-Start). Idempotent — zweite
 * Ausfuehrung ist No-op.
 *
 * Lokal:
 *   /Users/andreasbachmann/.bun/bin/bun run backend/scripts/migrate-projekte.ts
 */

import { migrateAuftraegeToProjekteIfNeeded } from '../src/apps/projektmanagement/projekt-service';

async function main(): Promise<void> {
  console.log('[migrate-projekte] Starte Migration Projektauftrag → Projekt...');
  const { created, skipped, errors } = await migrateAuftraegeToProjekteIfNeeded();
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
