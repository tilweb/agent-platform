/**
 * Cleanup-Skript: loescht das gemeinsam-genutzte `mem_default`-Memory-Row.
 *
 * Hintergrund: Bis zum Fix wurden alle User-Memory-Operationen ohne userId
 * auf den `default`-Row geschrieben (Cross-User-Leck — alle User teilten
 * dasselbe Memory). Nach dem Fix laeuft kein User mehr darauf, der Row ist
 * Altlast. Dieses Skript loescht ihn.
 *
 * Idempotent: laeuft auch wenn der Row schon weg ist.
 *
 * Usage:
 *   /Users/andreasbachmann/.bun/bin/bun run backend/scripts/cleanup-default-memory.ts
 */

import { eq } from 'drizzle-orm';
import { getDb } from '../src/db';
import { userMemory } from '../src/db/schema/memory';

async function main() {
  const db = getDb();

  // Erst lesen, damit wir den User Bescheid geben was geloescht wird.
  const rows = await db
    .select()
    .from(userMemory)
    .where(eq(userMemory.userId, 'default'));

  if (rows.length === 0) {
    console.log('[cleanup-default-memory] kein `default`-Row gefunden — nichts zu tun.');
    process.exit(0);
  }

  console.log(`[cleanup-default-memory] gefunden: ${rows.length} Row(s) mit userId='default'`);
  for (const row of rows) {
    const value = row.value as any;
    const aboutCount = Array.isArray(value?.about) ? value.about.length : 0;
    const instrCount = Array.isArray(value?.instructions) ? value.instructions.length : 0;
    const ctxCount = Array.isArray(value?.context) ? value.context.length : 0;
    console.log(
      `  - id=${row.id} key=${row.key}: ${aboutCount} about, ${instrCount} instructions, ${ctxCount} context`,
    );
  }

  const result = await db
    .delete(userMemory)
    .where(eq(userMemory.userId, 'default'))
    .returning({ id: userMemory.id });

  console.log(`[cleanup-default-memory] geloescht: ${result.length} Row(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[cleanup-default-memory] Fatal:', err);
  process.exit(1);
});
