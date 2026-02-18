/**
 * RBAC Migration Runner
 *
 * Run with: bun run src/rbac/run-migration.ts
 */

import { migrateProjectMembers } from './migration';

async function main() {
  console.log('='.repeat(60));
  console.log('RBAC Migration - Migriere bestehende Project Members');
  console.log('='.repeat(60));
  console.log('');

  const result = await migrateProjectMembers();

  console.log('');
  console.log('='.repeat(60));
  console.log('Migration abgeschlossen');
  console.log('='.repeat(60));
  console.log(`Migriert: ${result.migrated}`);
  console.log(`Übersprungen: ${result.skipped}`);
  console.log(`Fehler: ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log('');
    console.log('Fehlerdetails:');
    result.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err}`);
    });
  }

  console.log('');
}

main().catch((error) => {
  console.error('Migration fehlgeschlagen:', error);
  process.exit(1);
});
