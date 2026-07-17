/**
 * Instance-User-Report — zaehlt die User ueber ALLE Scalingo-Workplace-Instanzen.
 *
 * Enumeriert dynamisch alle `workplace-*`-Apps (`scalingo apps`) und fuehrt in
 * jeder laufenden Instanz `backend/scripts/report-users.ts` als read-only
 * One-off-Container aus. Weil `scalingo run` (attached) ein PTY braucht — das es
 * ueber gespawnte Prozesse nicht gibt — laeuft es **detached**: submitten, die
 * `one-off-<id>` aus der Ausgabe parsen, dann die App-Logs nach der
 * `##USERREPORT##`-Sentinel-Zeile pollen. Rein API-basiert (kein SSH-Key noetig).
 *
 * Sammelt die Zahlen jeder Instanz und gibt eine Tabelle mit Summen aus.
 * Hauptzahl = AKTIVE User. Neue Instanzen werden automatisch erfasst, sobald sie
 * aus `main` deployt sind (dann liegt das Zaehl-Skript im Image).
 *
 * Voraussetzung: eingeloggtes `scalingo` CLI (API-Token).
 *
 * Usage:
 *   /Users/andreasbachmann/.bun/bin/bun run tools/instance-user-report.ts
 *   … --json           maschinenlesbare Ausgabe (JSON-Array)
 *   … --concurrency 6  parallele Instanzen (Default 6)
 *   … --prefix foo     nur Apps mit diesem Namens-Praefix (Default: workplace-)
 *   … --timeout 120    Sekunden pro Instanz auf das Ergebnis warten (Default 120)
 */

const SENTINEL = '##USERREPORT##';

type Row = {
  app: string;
  status: string;
  title: string | null;
  total: number | null;
  active: number | null;
  admins: number | null;
  note: string; // '' bei Erfolg, sonst Grund fuer n/a
};

function parseArgs(argv: string[]) {
  const opts: Record<string, string> = {};
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--json') json = true;
    else if (a.startsWith('--')) opts[a.slice(2)] = argv[++i] ?? '';
  }
  return {
    json,
    concurrency: Math.max(1, parseInt(opts.concurrency || '6', 10)),
    prefix: opts.prefix || 'workplace-',
    timeoutMs: Math.max(20, parseInt(opts.timeout || '120', 10)) * 1000,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sh(cmd: string[]): Promise<{ out: string; code: number }> {
  const proc = Bun.spawn(cmd, { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { out: `${stdout}\n${stderr}`, code };
}

/** Parst `scalingo apps` (Box-Tabelle) → [{app, status}] gefiltert auf prefix. */
function parseApps(raw: string, prefix: string): { app: string; status: string }[] {
  const rows: { app: string; status: string }[] = [];
  for (const line of raw.split('\n')) {
    // Zeile: │ <name> │ <role> │ <status> │ <project> │
    const m = line.match(/^\s*│\s*([^\s│]+)\s*│[^│]*│\s*([^│]+?)\s*│/);
    if (!m) continue;
    const app = m[1]!;
    const status = m[2]!.trim();
    if (app.startsWith(prefix)) rows.push({ app, status });
  }
  return rows.sort((a, b) => a.app.localeCompare(b.app));
}

/** Submitted den detached One-off und gibt die `one-off-<id>` zurueck (oder null). */
async function submitDetached(app: string): Promise<string | null> {
  const { out } = await sh([
    'scalingo', '--app', app, 'run', '--detached', '--',
    'bun', 'run', 'backend/scripts/report-users.ts',
  ]);
  return out.match(/one-off-[0-9a-z]+/)?.[0] ?? null;
}

type PollResult = { ok: true; json: any } | { ok: false; note: string };

/** Pollt die App-Logs nach der Sentinel-Zeile des One-offs bis Timeout. */
async function pollSentinel(app: string, oneOff: string, deadline: number): Promise<PollResult> {
  let sawStop = false;
  while (Date.now() < deadline) {
    await sleep(3000);
    const { out } = await sh(['scalingo', '--app', app, 'logs', '--filter', oneOff, '--lines', '200']);
    const line = out.split('\n').find((l) => l.includes(SENTINEL));
    if (line) {
      try {
        return { ok: true, json: JSON.parse(line.slice(line.indexOf(SENTINEL) + SENTINEL.length).trim()) };
      } catch {
        return { ok: false, note: 'JSON-Parse-Fehler' };
      }
    }
    // Container fertig ohne Sentinel → Skript fehlt/fehlerhaft. Einmal noch fetchen, dann aufgeben.
    if (/has stopped/.test(out)) {
      if (sawStop) {
        const errish = /error|not found|ENOENT|Cannot find|panic/i.test(out);
        return { ok: false, note: errish ? 'Skript fehlt/Deploy alt?' : 'kein Ergebnis (One-off gestoppt)' };
      }
      sawStop = true;
    }
  }
  return { ok: false, note: 'Timeout' };
}

async function reportForApp(app: string, status: string, timeoutMs: number): Promise<Row> {
  const base: Row = { app, status, title: null, total: null, active: null, admins: null, note: '' };
  if (status !== 'running') return { ...base, note: `nicht laufend (${status})` };

  const oneOff = await submitDetached(app);
  if (!oneOff) return { ...base, note: 'Submit fehlgeschlagen' };

  const res = await pollSentinel(app, oneOff, Date.now() + timeoutMs);
  if (!res.ok) return { ...base, note: res.note };
  const j = res.json;
  return { ...base, title: j.title ?? null, total: j.total ?? 0, active: j.active ?? 0, admins: j.admins ?? 0 };
}

/** Einfache Concurrency-Pool-Ausfuehrung. */
async function pool<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const cur = idx++;
      results[cur] = await fn(items[cur]!, cur);
    }
  });
  await Promise.all(workers);
  return results;
}

const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length));
const padL = (s: string, n: number) => (s.length >= n ? s : ' '.repeat(n - s.length) + s);

function printTable(rows: Row[]) {
  const appW = Math.max(8, ...rows.map((r) => r.app.length));
  const titleW = Math.max(5, ...rows.map((r) => (r.title || '—').length));
  const header =
    `${pad('INSTANZ', appW)}  ${pad('TITLE', titleW)}  ${padL('AKTIV', 6)}  ${padL('TOTAL', 6)}  ${padL('ADMIN', 6)}  HINWEIS`;
  console.log('');
  console.log(header);
  console.log('─'.repeat(header.length));

  let sumActive = 0, sumTotal = 0, sumAdmin = 0, ok = 0;
  for (const r of rows) {
    const has = r.note === '' && r.active !== null;
    if (has) { sumActive += r.active!; sumTotal += r.total!; sumAdmin += r.admins!; ok++; }
    console.log(
      `${pad(r.app, appW)}  ${pad(r.title || '—', titleW)}  ${padL(has ? String(r.active) : '—', 6)}  ` +
        `${padL(has ? String(r.total) : '—', 6)}  ${padL(has ? String(r.admins) : '—', 6)}  ${r.note}`,
    );
  }
  console.log('─'.repeat(header.length));
  console.log(
    `${pad(`SUMME (${ok}/${rows.length} Instanzen)`, appW + 2 + titleW)}  ` +
      `${padL(String(sumActive), 6)}  ${padL(String(sumTotal), 6)}  ${padL(String(sumAdmin), 6)}`,
  );
  console.log('');
  console.log('AKTIV = abrechnungsrelevant (is_active=true). Demo-Instanzen enthalten Seed-User.');
}

async function main() {
  const { json, concurrency, prefix, timeoutMs } = parseArgs(Bun.argv.slice(2));

  const apps = parseApps((await sh(['scalingo', 'apps'])).out, prefix);
  if (apps.length === 0) {
    console.error(`Keine Apps mit Praefix "${prefix}" gefunden (ist das scalingo CLI eingeloggt?).`);
    process.exit(1);
  }
  if (!json) console.error(`Frage ${apps.length} Instanz(en) ab (parallel: ${concurrency}, One-off je Instanz) …`);

  const rows = await pool(apps, concurrency, (a) => reportForApp(a.app, a.status, timeoutMs));

  if (json) console.log(JSON.stringify(rows, null, 2));
  else printTable(rows);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
