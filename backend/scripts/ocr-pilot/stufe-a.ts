/**
 * OCR-Pilot Stufe A — offene OCR-Sprachmodelle lokal (Ollama / LM Studio) gegen den Golden Dataset messen.
 *
 * Eingabe: Scan-PDFs der Golden-Fälle (tools/wohngeld-golden/out/Fxx/Fxx-scan.pdf), Seite als PNG gerendert.
 * Referenz: Textlayer derselben Seite der digitalen Fassung (pdftotext). Metriken siehe metriken.ts.
 * OCR-Ausgaben werden je Modell/PDF-Hash/Seite/DPI zwischengespeichert — erneute Läufe werten nur neu aus.
 *
 * Aufruf (im backend/):
 *   bun run scripts/ocr-pilot/stufe-a.ts --liste
 *   bun run scripts/ocr-pilot/stufe-a.ts --modell ollama:glm-ocr --modell ollama:deepseek-ocr:3b
 *   bun run scripts/ocr-pilot/stufe-a.ts --modell lmstudio:<id> --faelle F03,F09 --dpi 150
 *   bun run scripts/ocr-pilot/stufe-a.ts --modell llamacpp:paddleocr-vl-1.6   (llama-server -m <gguf> --mmproj <mmproj> --port 8090)
 *   bun run scripts/ocr-pilot/stufe-a.ts --nur-auswertung            (nur Cache auswerten, kein Modellaufruf)
 * Optionen: --anweisung "<prompt>" überschreibt die Modellfamilien-Anweisung, --timeout <s> (Default 180),
 *           --max-seiten <n> begrenzt Seiten je Fall (Schnelltest).
 * Benötigt poppler (pdftocairo, pdftotext) im PATH, z. B. PATH=/opt/homebrew/bin:$PATH.
 */
import { mkdir, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { vergleicheSeite, summiere, hatSchleife, type SeitenMetrik } from './metriken';

const GOLDEN = resolve(import.meta.dir, '../../../tools/wohngeld-golden');
const AUSGABE = join(GOLDEN, 'out/ocr-pilot');
const OLLAMA = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const LMSTUDIO = process.env.LMSTUDIO_URL ?? 'http://localhost:1234';
/** llama.cpp `llama-server` (OpenAI-kompatibel) — für GGUF-Modelle mit getrenntem Vision-Encoder (mmproj), die LM Studio nicht koppelt. */
const LLAMACPP = process.env.LLAMACPP_URL ?? 'http://localhost:8090';

/** Fälle mit handschriftlich ausgefülltem Antrag (tools/wohngeld-golden, Fall-Definition `antrag.handschrift`). */
const HANDSCHRIFT = new Set(['F03', 'F09', 'F13', 'F19', 'F22', 'F26', 'F28']);
/** Stichprobe: Mischung aus Handschrift, Tabellen-lastigen Nachweisen und einfachen Fällen. */
const STANDARD_FAELLE = ['F01', 'F03', 'F05', 'F09', 'F13', 'F17', 'F22', 'F27'];
/** Antragsseiten (relativ zum Antragsbeginn): Deckblatt/Stammdaten, Haushalt, Einkommen, Unterschrift. */
const ANTRAG_SEITEN = [1, 2, 5, 10];

// ---------- CLI ----------
const argv = process.argv.slice(2);
const opt = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const alle = (name: string): string[] => argv.flatMap((a, i) => (a === name && argv[i + 1] ? [argv[i + 1]!] : []));
const flag = (name: string) => argv.includes(name);

const modelle = alle('--modell');
const faelle = (opt('--faelle')?.split(',').map((s) => s.trim().toUpperCase()) ?? STANDARD_FAELLE);
const dpi = Number(opt('--dpi') ?? 150);
const timeoutS = Number(opt('--timeout') ?? 180);
const maxSeiten = opt('--max-seiten') ? Number(opt('--max-seiten')) : Infinity;
const anweisungOverride = opt('--anweisung');
const nurAuswertung = flag('--nur-auswertung');

// ---------- Modell-Endpunkte ----------
type Anbieter = 'ollama' | 'lmstudio' | 'llamacpp';
interface Modell { anbieter: Anbieter; id: string; schluessel: string }

function parseModell(s: string): Modell {
  const i = s.indexOf(':');
  const anbieter = s.slice(0, i) as Anbieter;
  if (i < 0 || !['ollama', 'lmstudio', 'llamacpp'].includes(anbieter)) throw new Error(`--modell erwartet ollama:<name>, lmstudio:<id> oder llamacpp:<name>, nicht "${s}"`);
  const id = s.slice(i + 1);
  return { anbieter, id, schluessel: `${anbieter}__${id.replace(/[^a-zA-Z0-9._-]+/g, '_')}` };
}

/** Anweisung je Modellfamilie laut Modellkarte (die Modelle sind auf ihren Trainings-Prompt empfindlich). */
export function anweisungFuer(id: string): string {
  const m = id.toLowerCase();
  if (m.includes('glm')) return 'Text Recognition:';
  if (m.includes('deepseek')) return 'Free OCR.';
  if (m.includes('paddle')) return 'OCR:';
  if (m.includes('unlimited')) return 'document parsing.';
  if (m.includes('lighton')) return '';
  return 'Extract all text from this document page. Output plain text only.';
}

async function listeModelle() {
  try {
    const r = await fetch(`${OLLAMA}/api/tags`);
    const j = await r.json() as { models: { name: string; details?: { parameter_size?: string; quantization_level?: string } }[] };
    console.log(`Ollama (${OLLAMA}):`);
    for (const m of j.models) console.log(`  ollama:${m.name}  ${m.details?.parameter_size ?? ''} ${m.details?.quantization_level ?? ''}`);
  } catch { console.log(`Ollama (${OLLAMA}): nicht erreichbar`); }
  try {
    const r = await fetch(`${LMSTUDIO}/v1/models`);
    const j = await r.json() as { data: { id: string }[] };
    console.log(`LM Studio (${LMSTUDIO}):`);
    for (const m of j.data) console.log(`  lmstudio:${m.id}`);
  } catch { console.log(`LM Studio (${LMSTUDIO}): nicht erreichbar (Server starten: ~/.cache/lm-studio/bin/lms server start)`); }
}

async function ocr(modell: Modell, png: Uint8Array, anweisung: string): Promise<string> {
  const b64 = Buffer.from(png).toString('base64');
  const signal = AbortSignal.timeout(timeoutS * 1000);
  if (modell.anbieter === 'ollama') {
    const r = await fetch(`${OLLAMA}/api/generate`, {
      method: 'POST', signal,
      body: JSON.stringify({ model: modell.id, prompt: anweisung, images: [b64], stream: false, options: { temperature: 0, num_ctx: 16384, num_predict: 8192 } }),
    });
    if (!r.ok) throw new Error(`Ollama ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return ((await r.json()) as { response: string }).response;
  }
  const inhalt: unknown[] = [{ type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } }];
  if (anweisung) inhalt.push({ type: 'text', text: anweisung });
  const r = await fetch(`${modell.anbieter === 'llamacpp' ? LLAMACPP : LMSTUDIO}/v1/chat/completions`, {
    method: 'POST', signal, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: modell.id, temperature: 0, max_tokens: 8192, messages: [{ role: 'user', content: inhalt }] }),
  });
  if (!r.ok) throw new Error(`${modell.anbieter} ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return ((await r.json()) as { choices: { message: { content: string } }[] }).choices[0]?.message.content ?? '';
}

// ---------- Seiten-Stichprobe ----------
interface Seite { fall: string; seite: number; art: string; handschrift: boolean }

async function stichprobe(): Promise<Seite[]> {
  const seiten: Seite[] = [];
  for (const fall of faelle) {
    const exp = await Bun.file(join(GOLDEN, 'expected', `${fall}.expected.json`)).json() as {
      seiten: number; dokumente: { seiteVon: number; seiteBis: number; art: string }[];
    };
    const jeFall: Seite[] = [];
    for (const d of exp.dokumente) {
      if (d.art === 'antrag') {
        for (const rel of ANTRAG_SEITEN) {
          const s = d.seiteVon + rel - 1;
          if (s <= d.seiteBis) jeFall.push({ fall, seite: s, art: 'antrag', handschrift: HANDSCHRIFT.has(fall) });
        }
      } else jeFall.push({ fall, seite: d.seiteVon, art: d.art, handschrift: false });
    }
    seiten.push(...jeFall.slice(0, maxSeiten));
  }
  return seiten;
}

// ---------- IO-Helfer ----------
const run = async (cmd: string[]) => {
  const p = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' });
  const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  if (code !== 0) throw new Error(`${cmd[0]} (${code}): ${err.slice(0, 300)}`);
  return out;
};

const hashCache = new Map<string, string>();
async function pdfHash(pfad: string) {
  if (!hashCache.has(pfad)) hashCache.set(pfad, new Bun.CryptoHasher('sha256').update(await Bun.file(pfad).arrayBuffer()).digest('hex').slice(0, 12));
  return hashCache.get(pfad)!;
}

const scanPdf = (fall: string) => join(GOLDEN, 'out', fall, `${fall}-scan.pdf`);
const digitalPdf = (fall: string) => join(GOLDEN, 'out', fall, `${fall}-digital.pdf`);

async function seitenBild(s: Seite): Promise<Uint8Array> {
  const pdf = scanPdf(s.fall);
  const ziel = join(AUSGABE, 'bilder', `${s.fall}-${await pdfHash(pdf)}-s${s.seite}-${dpi}dpi`);
  const f = Bun.file(`${ziel}.png`);
  if (!(await f.exists())) await run(['pdftocairo', '-png', '-r', String(dpi), '-f', String(s.seite), '-l', String(s.seite), '-singlefile', pdf, ziel]);
  return new Uint8Array(await Bun.file(`${ziel}.png`).arrayBuffer());
}

const referenz = (s: Seite) => run(['pdftotext', '-layout', '-f', String(s.seite), '-l', String(s.seite), digitalPdf(s.fall), '-']);

// ---------- Lauf ----------
interface Ergebnis { fall: string; seite: number; art: string; handschrift: boolean; sekunden: number | null; fehler?: string; schleife?: boolean; metrik?: SeitenMetrik }

async function cachePfad(modell: string, s: Seite) {
  return join(AUSGABE, 'cache', modell, `${s.fall}-${await pdfHash(scanPdf(s.fall))}-s${s.seite}-${dpi}dpi.json`);
}

async function laufeModell(modell: Modell, seiten: Seite[]): Promise<Ergebnis[]> {
  const anweisung = anweisungOverride ?? anweisungFuer(modell.id);
  await mkdir(join(AUSGABE, 'cache', modell.schluessel), { recursive: true });
  await mkdir(join(AUSGABE, 'bilder'), { recursive: true });
  const erg: Ergebnis[] = [];
  let i = 0;
  for (const s of seiten) {
    i++;
    const pfad = await cachePfad(modell.schluessel, s);
    let eintrag = (await Bun.file(pfad).exists()) ? await Bun.file(pfad).json() as { text?: string; sekunden: number | null; fehler?: string; anweisung: string } : null;
    if (eintrag && (eintrag.anweisung !== anweisung || eintrag.fehler)) eintrag = null; // anderer Prompt oder Fehler → neu erkennen
    if (!eintrag && !nurAuswertung) {
      const png = await seitenBild(s);
      const t0 = performance.now();
      try {
        const text = await ocr(modell, png, anweisung);
        eintrag = { text, sekunden: (performance.now() - t0) / 1000, anweisung };
      } catch (e) {
        eintrag = { sekunden: null, fehler: String((e as Error).message ?? e), anweisung };
      }
      await Bun.write(pfad, JSON.stringify(eintrag, null, 2));
    }
    if (!eintrag) continue;
    const ref = eintrag.text != null ? await referenz(s) : '';
    const metrik = eintrag.text != null ? vergleicheSeite(ref, eintrag.text) : undefined;
    const r: Ergebnis = { ...s, sekunden: eintrag.sekunden, fehler: eintrag.fehler, schleife: eintrag.text != null && hatSchleife(eintrag.text, ref), metrik };
    erg.push(r);
    const kurz = metrik ? `Recall ${pz(metrik.treffer / (metrik.refWoerter || 1))} Zahlen ${pz(metrik.zahlenTreffer / (metrik.refZahlen || 1))}` : `FEHLER ${r.fehler}`;
    console.log(`  [${i}/${seiten.length}] ${s.fall} S.${s.seite} ${s.art}${s.handschrift ? ' (Handschrift)' : ''}: ${kurz}${r.sekunden != null ? ` · ${r.sekunden.toFixed(1)} s` : ''}${r.schleife ? ' · SCHLEIFE' : ''}`);
  }
  return erg;
}

const pz = (x: number) => `${(x * 100).toFixed(1)} %`;

function zeile(name: string, e: Ergebnis[]): string[] {
  if (!e.length) return [];
  const ok = e.filter((x) => x.metrik);
  const s = summiere(ok.map((x) => x.metrik!));
  const zeiten = ok.map((x) => x.sekunden!).filter((x) => x != null).sort((a, b) => a - b);
  const median = zeiten[Math.floor(zeiten.length / 2)] ?? 0;
  return [`| ${name} | ${ok.length}/${e.length} | ${pz(s.recall)} | ${pz(s.praezision)} | ${pz(s.zahlenRecall)} | ${e.filter((x) => x.schleife).length} | ${median.toFixed(1)} s |`];
}

async function bericht(alleErg: Map<string, Ergebnis[]>) {
  const kopf = '| Modell / Teilmenge | Seiten ok | Wort-Recall | Wort-Präzision | Zahlen-Recall | Schleifen | Median Zeit/Seite |\n|---|---|---|---|---|---|---|';
  const zeilen: string[] = [];
  for (const [m, e] of alleErg) {
    zeilen.push(...zeile(`**${m}**`, e));
    zeilen.push(...zeile('↳ Antrag maschinell', e.filter((x) => x.art === 'antrag' && !x.handschrift)));
    zeilen.push(...zeile('↳ Antrag Handschrift', e.filter((x) => x.handschrift)));
    zeilen.push(...zeile('↳ Nachweise', e.filter((x) => x.art !== 'antrag')));
  }
  const md = [
    `# OCR-Pilot Stufe A — Ergebnis ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    '',
    `Fälle: ${faelle.join(', ')} · ${dpi} dpi · Scan-Fassung gegen Textlayer der digitalen Fassung (Wort-Multimenge, reihenfolgeunabhängig).`,
    '',
    kopf, ...zeilen, '',
    'Hinweise: Pipeline-Modelle (PaddleOCR-VL, GLM-OCR) sind für Layout-Erkennung + Teilbereichs-OCR trainiert; hier laufen sie im Ganzseiten-Modus und können dadurch schlechter abschneiden als in ihrer Originalpipeline.',
    'Schleifen = Seiten, auf denen das Modell in eine Wiederholung geraten ist (drückt die Präzision, kostet Zeit bis zum Tokenlimit).',
    'Die Referenz enthält auch Kleingedrucktes/Fußzeilen des Formulars — Recall unter 100 % ist erwartbar, entscheidend ist der Modellvergleich und der Zahlen-Recall.',
  ].join('\n');
  await Bun.write(join(AUSGABE, 'bericht.md'), md);
  const json = Object.fromEntries([...alleErg].map(([m, e]) => [m, e]));
  await Bun.write(join(AUSGABE, 'ergebnis.json'), JSON.stringify({ faelle, dpi, modelle: json }, null, 2));
  console.log(`\n${kopf}\n${zeilen.join('\n')}\n\nBericht: ${join(AUSGABE, 'bericht.md')}`);
}

async function main() {
  if (flag('--liste')) return listeModelle();
  let ziele = modelle.map(parseModell);
  if (nurAuswertung && !ziele.length) {
    const vorhanden = await readdir(join(AUSGABE, 'cache')).catch(() => [] as string[]);
    ziele = vorhanden.map((k) => ({ anbieter: k.split('__')[0] as Anbieter, id: k.split('__').slice(1).join('__'), schluessel: k }));
  }
  if (!ziele.length) { console.error('Kein Modell angegeben. --modell ollama:<name> | lmstudio:<id>, oder --liste'); process.exit(1); }
  const seiten = await stichprobe();
  console.log(`${seiten.length} Seiten aus ${faelle.length} Fällen, ${dpi} dpi`);
  const alleErg = new Map<string, Ergebnis[]>();
  for (const m of ziele) {
    console.log(`\n== ${m.anbieter}:${m.id} (Anweisung: "${anweisungOverride ?? anweisungFuer(m.id)}")`);
    alleErg.set(`${m.anbieter}:${m.id}`, await laufeModell(m, seiten));
  }
  await bericht(alleErg);
}

if (import.meta.main) await main();
