#!/usr/bin/env bun
/**
 * CLI-Wrapper: Wohngeld-Demo-Seed.
 *
 * Dünner Aufrufer um `seedWohngeldDemo()` (Logik: src/apps/wohngeld/seed-demo.ts).
 * Managt die DB-Verbindung (Env-Guard + closeSql) und den Prozess-Exit.
 *
 *   cd backend && /Users/andreasbachmann/.bun/bin/bun run scripts/seed-wohngeld.ts
 *     Standard = Reset (bestehende Demo-Akten löschen und neu anlegen).
 *   … scripts/seed-wohngeld.ts --keep
 *     create-if-absent (kein Reset): nur anlegen, wenn noch keine Demo-Akte da ist.
 *
 * Voraussetzung: dieselbe DB-Env wie die App (z. B. SCALINGO_POSTGRES in backend/.env).
 * Ohne DB-Env bricht das Skript mit einer freundlichen Meldung ab.
 *
 * WICHTIG: NICHT committen — reines Demo-/Dev-Werkzeug.
 */
import { seedWohngeldDemo } from '../src/apps/wohngeld/seed-demo';
import { closeSql } from '../src/db/client';

if (!process.env.SCALINGO_POSTGRES) {
  console.error(
    '\n✗ SCALINGO_POSTGRES ist nicht gesetzt.\n' +
      '  Das Seed-Skript schreibt in dieselbe Postgres-DB wie die App.\n' +
      '  Setze die Verbindung in backend/.env (SCALINGO_POSTGRES=postgres://…) und\n' +
      '  führe dann erneut aus:\n' +
      '    cd backend && /Users/andreasbachmann/.bun/bin/bun run scripts/seed-wohngeld.ts\n',
  );
  process.exit(1);
}

// Manueller Lauf: Standard = Reset. `--keep` → create-if-absent (kein Reset).
const reset = !process.argv.includes('--keep');

try {
  console.log(`\n▶ Wohngeld-Demo-Seed (${reset ? 'Reset: bestehende Demo-Akten werden ersetzt' : '--keep: create-if-absent'})`);
  const r = await seedWohngeldDemo({ reset });
  console.log('\n========== BILANZ ==========');
  if (r.skipped) {
    console.log('Übersprungen — es existieren bereits Demo-Akten (--keep, create-if-absent).');
    console.log('Zum Neuaufbau ohne --keep ausführen (Reset).');
  } else {
    console.log(`Akten angelegt:    ${r.aktenCreated}`);
    console.log(`Vorgänge angelegt: ${r.vorgaengeCreated}`);
    console.log('\n✓ Demo-Daten angelegt. App starten und live durchklicken.');
  }
  await closeSql();
  process.exit(0);
} catch (err) {
  console.error('\n✗ Seed fehlgeschlagen:', err instanceof Error ? err.message : err);
  await closeSql();
  process.exit(1);
}
