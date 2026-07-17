/**
 * Report-Skript: zaehlt die User dieser Instanz (Postgres `auth.users`).
 *
 * Laeuft read-only im Container einer Scalingo-Instanz und gibt GENAU EINE
 * Sentinel-Zeile auf stdout aus, die der lokale Orchestrator
 * (`tools/instance-user-report.ts`) aus dem `scalingo run`-Rauschen grep­pt:
 *
 *   ##USERREPORT## {"title":"…","total":N,"active":N,"admins":N}
 *
 * Der Titel kommt aus `PLATFORM_TITLE`, die Zahlen aus einer einzigen
 * Aggregat-Query. Keine Writes.
 *
 * Usage (lokal mit DB-Env):
 *   /Users/andreasbachmann/.bun/bin/bun run backend/scripts/report-users.ts
 * Auf Scalingo:
 *   scalingo --app <app> run --silent -- bun run backend/scripts/report-users.ts
 */

import { getSql, closeSql } from '../src/db/client';

const SENTINEL = '##USERREPORT##';

async function main() {
  const sql = getSql();
  const [row] = await sql<
    { total: number; active: number; admins: number }[]
  >`
    select count(*)::int                               as total,
           count(*) filter (where is_active)::int      as active,
           count(*) filter (where role = 'admin')::int as admins
    from auth.users
  `;

  const payload = {
    title: process.env.PLATFORM_TITLE || null,
    total: row?.total ?? 0,
    active: row?.active ?? 0,
    admins: row?.admins ?? 0,
  };

  // Genau eine, eindeutig prefixte Zeile — alles andere ist Rauschen.
  console.log(`${SENTINEL} ${JSON.stringify(payload)}`);
}

main()
  .then(async () => {
    await closeSql();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(`report-users failed: ${err instanceof Error ? err.message : String(err)}`);
    await closeSql().catch(() => {});
    process.exit(1);
  });
