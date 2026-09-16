/**
 * M2b: Exportiert wzbar.matches einer Produktions-Instanz als JSON.
 *
 * Aufruf (aus backend/):
 *   bun src/apps/wzbar-matcher/eval/export-prod-matches.ts <postgres-url|env:VARNAME> <out.json>
 *
 * Die URL ist der SCALINGO_POSTGRESQL_URL der Instanz (Scalingo-DBs sind mit
 * TLS von aussen erreichbar) oder eine db-tunnel-Adresse. Mit `env:VARNAME`
 * wird die URL aus der Umgebung/.env gelesen (Bun laedt .env automatisch),
 * ohne sie je auf der Kommandozeile auszugeben. Es wird ausschliesslich
 * lesend auf wzbar.matches zugegriffen.
 */

const [urlArg, outPath] = process.argv.slice(2);
if (!urlArg || !outPath) {
  console.error('Usage: bun export-prod-matches.ts <postgres-url|env:VARNAME> <out.json>');
  process.exit(1);
}
let url = urlArg.startsWith('env:') ? process.env[urlArg.slice(4)] : urlArg;
if (!url) {
  console.error(`Umgebungsvariable ${urlArg.slice(4)} ist nicht gesetzt (backend/.env?).`);
  process.exit(1);
}

// --via-tunnel <port>: Host/Port der URL auf einen lokalen scalingo db-tunnel
// umbiegen (fuer DBs ohne Internet-Zugriff). Credentials bleiben unveraendert.
const tunnelIdx = process.argv.indexOf('--via-tunnel');
if (tunnelIdx !== -1) {
  const port = process.argv[tunnelIdx + 1] ?? '10000';
  const u = new URL(url);
  u.hostname = '127.0.0.1';
  u.port = port;
  u.searchParams.delete('sslmode'); // Tunnel-Endpunkt spricht kein TLS
  url = u.toString();
}

const sql = new Bun.SQL(url);
const rows = await sql.unsafe(`
  SELECT id,
         user_id        AS "userId",
         input_text     AS "inputText",
         result,
         retrieval_top_k AS "retrievalTopK",
         llm_model      AS "llmModel",
         embedding_model AS "embeddingModel",
         duration_ms    AS "durationMs",
         created_at     AS "createdAt"
  FROM wzbar.matches
  ORDER BY created_at ASC
`);
await sql.end();

await Bun.write(outPath, JSON.stringify(rows, null, 1));
console.log(`${rows.length} Matches exportiert → ${outPath}`);
process.exit(0);
