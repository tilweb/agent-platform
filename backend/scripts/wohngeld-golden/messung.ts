/**
 * Golden-Dataset-Messung für die Wohngeld-App.
 * Spec: docs/wohngeld-golden-messwerkzeug-spec-2026-09-24.md
 *
 * Aufruf im backend/-Ordner:
 *   bun run scripts/wohngeld-golden/messung.ts                       # alle Fälle, digital, alle Stufen
 *   bun run scripts/wohngeld-golden/messung.ts --faelle F01,F18 --variante beide
 *   bun run scripts/wohngeld-golden/messung.ts --stufen regelwerk    # nur Regeln, ohne LLM (Sekunden)
 *   Optionen: --stufen split,extraktion,posteingang,regelwerk  --ende-zu-ende  --ohne-cache  --parallel 3
 *   --erkennung profil   Split + Typ + Felder aus EINEM Lauf des DP-Segmentprofils „Wohngeld-Eingang"
 *                        (statt bisheriger Grenzprüfung + eigener Klassifikation)
 */
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pruefeVorgang } from '../../src/apps/wohngeld/checker';
import { klassifiziereUndExtrahiere } from '../../src/apps/wohngeld/extraction';
import { WOHNGELD_PROMPT_VERSION } from '../../src/apps/wohngeld/ki-governance';
import { defaultSplitDeps, pruefeUndTrenne } from '../../src/apps/wohngeld/posteingang-split';
import { extractionModelLabel } from '../../src/extraction/model';
import { buildPartPdf } from '../../src/services/extraction/pdf-split';
import { erzeugeBericht } from './bericht';
import { erkenneDokumente, ladeProfil } from '../../src/apps/wohngeld/dp-erkennung';
import { stableHash } from '../../src/extraction/learning/snapshot';
import { erwartetePersonen, posteingangSnapshot, regelwerkSnapshot, type ErwartungKurz, type ExtraktionKurz, type FallKurz } from './snapshot';
import { einkommensArtAusText, nachnameGleich, PERSONEN_TYPEN, vornameGleich } from '../../src/apps/wohngeld/haushalt';
import {
  haushaltMetrik, ordneZu, splitMetrik, vergleicheFelder, werteBefundeAus, zuordnungMetrik,
  type Bereich, type BefundAuswertung, type FeldErgebnis, type HaushaltMetrik, type SplitMetrik, type ZuordnungMetrik,
} from './vergleich';

const TOOLS = join(import.meta.dir, '..', '..', '..', 'tools', 'wohngeld-golden');
const CACHE = join(TOOLS, 'out', 'messung', 'cache');

// ── Argumente ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opt = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const flag = (name: string) => argv.includes(`--${name}`);
const faelleFilter = opt('faelle')?.split(',').map((s) => s.trim().toUpperCase());
const variantenArg = opt('variante') ?? 'digital';
const varianten = variantenArg === 'beide' ? ['digital', 'scan'] : [variantenArg];
const stufen = new Set((opt('stufen') ?? 'split,extraktion,posteingang,regelwerk').split(','));
const endeZuEnde = flag('ende-zu-ende');
const ohneCache = flag('ohne-cache');
const parallel = Number(opt('parallel') ?? 3);
const erkennung = (opt('erkennung') ?? 'legacy') === 'profil' ? 'profil' : 'legacy';

// ── Hilfen ───────────────────────────────────────────────────────────────────
const sha = (b: Uint8Array | string) => new Bun.CryptoHasher('sha256').update(b).digest('hex');
const MODELL = extractionModelLabel();

async function mitCache<T>(art: string, schluessel: string, fn: () => Promise<T>): Promise<{ wert: T; cache: boolean }> {
  const pfad = join(CACHE, art, `${sha(`${schluessel}|${MODELL}|${WOHNGELD_PROMPT_VERSION}`).slice(0, 32)}.json`);
  if (!ohneCache && (await Bun.file(pfad).exists())) return { wert: (await Bun.file(pfad).json()) as T, cache: true };
  const wert = await fn();
  await mkdir(join(CACHE, art), { recursive: true });
  await Bun.write(pfad, JSON.stringify(wert));
  return { wert, cache: false };
}

async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]!, i); }
  }));
  return out;
}

// ── Ergebnis-Typen ───────────────────────────────────────────────────────────
export interface DokumentMessung {
  nr: number; seiteVon: number; seiteBis: number; art: string;
  typErwartet: string; typErkannt: string | null; teil: Bereich | null;
  felder: FeldErgebnis[]; fehler?: string;
}
export interface FallMessung {
  fall: string; titel: string; gruppe: string; variante: string; seiten: number;
  split?: { metrik: SplitMetrik; gefunden: Bereich[]; hinweis?: string; cache: boolean };
  dokumente?: DokumentMessung[];
  posteingang?: BefundAuswertung & { app: string[] };
  /** Posteingang: aus dem Antrag angelegte Personen gegen den Fall. */
  haushalt?: HaushaltMetrik;
  /** Posteingang: Nachweise der richtigen Person zugeordnet? */
  zuordnung?: ZuordnungMetrik;
  regelwerk?: BefundAuswertung & { app: string[] };
  dauerSek: number;
  fehler?: string;
}

type ErwDok = ErwartungKurz['dokumente'][number] & { nr: number; seiteVon: number; seiteBis: number; art: string; leerseite?: boolean };
interface ErwartungVoll {
  seiten: number;
  dokumente: ErwDok[];
  pruefung: { befunde: string[]; standardbefunde: string[]; appVermutlichZusaetzlich: Array<{ regelId: string }> };
}

// ── Lauf ─────────────────────────────────────────────────────────────────────
const { FAELLE } = (await import(join(TOOLS, 'src', 'faelle', 'index.ts'))) as { FAELLE: Array<FallKurz & { id: string; titel: string; gruppe: string }> };
const auswahl = FAELLE.filter((f) => !faelleFilter || faelleFilter.includes(f.id));
const lauf = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const ausgabe = join(TOOLS, 'out', 'messung', lauf);
await mkdir(ausgabe, { recursive: true });
const profil = erkennung === 'profil' ? await ladeProfil() : null;
const profilSchluessel = profil ? stableHash([profil.profil.segments, profil.profil.instructions, profil.profil.extraction, profil.beispiele.map((b) => b.id)]) : '';
console.log(`Messlauf ${lauf} · ${auswahl.length} Fälle · Variante(n) ${varianten.join('+')} · Stufen ${[...stufen].join(',')}${endeZuEnde ? ' · Ende-zu-Ende' : ' · Orakel-Grenzen'} · Modell ${MODELL}${profil ? ` · Erkennung: DP-Profil (${profil.quelle})` : ''}`);

const ergebnisse: FallMessung[] = [];
for (const fall of auswahl) {
  const erw = (await Bun.file(join(TOOLS, 'expected', `${fall.id}.expected.json`)).json()) as ErwartungVoll;
  // Regelwerk (ohne LLM, unabhängig von der Variante)
  const regelwerk = stufen.has('regelwerk')
    ? (() => { const app = pruefeVorgang(regelwerkSnapshot(fall, erw)).map((b) => b.regelId); return { app, ...werteBefundeAus(app, erw.pruefung) }; })()
    : undefined;

  for (const variante of varianten) {
   try {
    const t0 = performance.now();
    const pdfPfad = join(TOOLS, 'out', fall.id, `${fall.id}-${variante}.pdf`);
    const m: FallMessung = { fall: fall.id, titel: fall.titel, gruppe: fall.gruppe, variante, seiten: erw.seiten, regelwerk, dauerSek: 0 };
    const braucht = stufen.has('split') || stufen.has('extraktion') || stufen.has('posteingang');
    if (braucht && !(await Bun.file(pdfPfad).exists())) {
      console.error(`⚠ ${pdfPfad} fehlt — erst \`bun run src/cli.ts\` in tools/wohngeld-golden ausführen`);
      ergebnisse.push(m);
      continue;
    }
    const bytes = braucht ? new Uint8Array(await Bun.file(pdfPfad).arrayBuffer()) : new Uint8Array();
    const pdfHash = braucht ? sha(bytes) : '';
    const erwartetBereiche: Bereich[] = erw.dokumente.map((d) => ({ von: d.seiteVon, bis: d.seiteBis }));

    // 0. Erkennung über das DP-Segmentprofil: Split + Typ + Felder aus einem Lauf.
    if (profil && (stufen.has('split') || stufen.has('extraktion') || stufen.has('posteingang'))) {
      const { wert, cache } = await mitCache('profil', `${pdfHash}|${profilSchluessel}`, async () => {
        const r = await erkenneDokumente(bytes, { filename: `${fall.id}-${variante}.pdf`, profil });
        return { abschnitte: r.abschnitte.map((a) => ({ von: a.seiteVon, bis: a.seiteBis, abschnitt: a.abschnitt, typ: a.typ, analyse: a.analyse, stammdaten: a.stammdaten, identitaet: a.identitaet })), hinweise: r.hinweise };
      });
      const teile = wert.abschnitte.map((a) => ({ von: a.von, bis: a.bis }));
      m.split = { metrik: splitMetrik(erw.dokumente, teile), gefunden: teile, hinweis: wert.hinweise.join(' ') || undefined, cache };
      const zuordnung = ordneZu(erw.dokumente, teile);
      m.dokumente = erw.dokumente.map((d, i) => {
        const a = zuordnung[i]! >= 0 ? wert.abschnitte[zuordnung[i]!] : undefined;
        return {
          nr: d.nr, seiteVon: d.seiteVon, seiteBis: d.seiteBis, art: d.art,
          typErwartet: d.typ, typErkannt: a?.typ ?? null, teil: a ? { von: a.von, bis: a.bis } : null,
          felder: a ? vergleicheFelder(d.erwartet as never, { stammdaten: a.stammdaten, analyse: a.analyse, identitaet: a.identitaet }) : [],
        };
      });
      if (stufen.has('posteingang')) {
        const snap = posteingangSnapshot(wert.abschnitte.map((a) => ({ typ: a.typ, analyse: a.analyse, stammdaten: a.stammdaten, identitaet: a.identitaet })));
        const app = pruefeVorgang(snap).map((b) => b.regelId);
        m.posteingang = { app, ...werteBefundeAus(app, erw.pruefung) };
        m.haushalt = haushaltMetrik(erwartetePersonen(fall, einkommensArtAusText), snap.personen,
          (a, b) => vornameGleich(a.vorname, b.vorname) && nachnameGleich(a.nachname, b.nachname));
        m.zuordnung = zuordnungMetrik(erw.dokumente, zuordnung, snap.zuordnungen.map((z) => z.personId), m.haushalt.abbildung, PERSONEN_TYPEN);
      }
      m.dauerSek = Math.round((performance.now() - t0) / 100) / 10;
      ergebnisse.push(m);
      console.log(`${fall.id} ${variante.padEnd(7)} Profil: Split ${m.split.metrik.treffer}/${m.split.metrik.erwarteteSchnitte} Schnitte, ${m.split.metrik.fehlalarme} Fehlschnitte · ${m.dokumente.filter((x) => x.typErkannt === x.typErwartet).length}/${m.dokumente.length} Typ${m.posteingang ? ` · Posteingang verfehlt ${m.posteingang.verfehlt.length}, Fehlalarm ${m.posteingang.fehlalarm.length}` : ''}${m.haushalt ? ` · Haushalt ${m.haushalt.gefunden}/${m.haushalt.erwartet}` : ''}${m.zuordnung ? ` · Zuordnung ${m.zuordnung.richtig}/${m.zuordnung.geprueft}` : ''} (${m.dauerSek}s${cache ? ', Cache' : ''})`);
      await Bun.write(join(ausgabe, 'ergebnis.json'), JSON.stringify({ lauf, modell: MODELL, promptStand: WOHNGELD_PROMPT_VERSION, endeZuEnde, erkennung, ergebnisse }, null, 2));
      continue;
    }

    // 1. Split
    let gefunden: Bereich[] | null = null;
    if (stufen.has('split') || (endeZuEnde && stufen.has('extraktion'))) {
      const { wert, cache } = await mitCache('split', pdfHash, async () => {
        const r = await pruefeUndTrenne(
          { dateiname: `${fall.id}-${variante}.pdf`, contentType: 'application/pdf', groesse: bytes.length, hash: pdfHash },
          {},
          { ...defaultSplitDeps, load: async () => bytes, store: async (_b, name) => ({ pfad: `mem/${name}`, dateiname: name }) },
        );
        const bereiche = r.getrennt ? r.bereiche!.map((b) => ({ von: b.from, bis: b.to })) : [{ von: 1, bis: r.dateien[0]?.trennung?.seitenGesamt ?? erw.seiten }];
        return { bereiche, hinweis: r.hinweis ?? r.dateien[0]?.trennung?.hinweis };
      });
      gefunden = wert.bereiche;
      m.split = { metrik: splitMetrik(erw.dokumente, wert.bereiche), gefunden: wert.bereiche, hinweis: wert.hinweis, cache };
    }

    // 2. Klassifikation + Extraktion
    let extrahiert: ExtraktionKurz[] = [];
    if (stufen.has('extraktion') || stufen.has('posteingang')) {
      const teile = endeZuEnde && gefunden ? gefunden : erwartetBereiche;
      const tmp = await mkdtemp(join(tmpdir(), 'wg-messung-'));
      const quelle = join(tmp, 'src.pdf');
      await Bun.write(quelle, bytes);
      try {
        const roh = await pool(teile, parallel, async (t) => {
          const teilBytes = new Uint8Array(await buildPartPdf(quelle, t.von, t.bis));
          try {
            const { wert } = await mitCache('extraktion', sha(teilBytes), async () => {
              const e = await klassifiziereUndExtrahiere(teilBytes, 'application/pdf', { filename: `${fall.id}-S${t.von}-${t.bis}.pdf` });
              return { typ: e.typ, analyse: e.analyse, stammdaten: e.stammdaten, identitaet: e.identitaet };
            });
            return wert as ExtraktionKurz & { identitaet?: unknown; fehler?: string };
          } catch (err) {
            return { typ: 'sonstiges', fehler: err instanceof Error ? err.message : String(err) } as ExtraktionKurz & { fehler: string };
          }
        });
        extrahiert = roh;
        const zuordnung = endeZuEnde && gefunden ? ordneZu(erw.dokumente, teile) : erw.dokumente.map((_, i) => i);
        m.dokumente = erw.dokumente.map((d, i) => {
          const j = zuordnung[i]!;
          const e = j >= 0 ? (roh[j] as ExtraktionKurz & { identitaet?: unknown; fehler?: string }) : undefined;
          return {
            nr: d.nr, seiteVon: d.seiteVon, seiteBis: d.seiteBis, art: d.art,
            typErwartet: d.typ, typErkannt: e?.typ ?? null, teil: j >= 0 ? teile[j]! : null,
            felder: e ? vergleicheFelder(d.erwartet as never, { stammdaten: e.stammdaten, analyse: e.analyse, identitaet: e.identitaet }) : [],
            ...(e?.fehler ? { fehler: e.fehler } : {}),
          };
        });
      } finally {
        await rm(tmp, { recursive: true, force: true });
      }
    }

    // 3. Prüfung auf dem Posteingang-Stand
    if (stufen.has('posteingang') && extrahiert.length) {
      const app = pruefeVorgang(posteingangSnapshot(extrahiert)).map((b) => b.regelId);
      m.posteingang = { app, ...werteBefundeAus(app, erw.pruefung) };
    }

    m.dauerSek = Math.round((performance.now() - t0) / 100) / 10;
    ergebnisse.push(m);
    const typTreffer = m.dokumente ? `${m.dokumente.filter((d) => d.typErkannt === d.typErwartet).length}/${m.dokumente.length} Typ` : '';
    const sp = m.split ? `Split ${m.split.metrik.treffer}/${m.split.metrik.erwarteteSchnitte} Schnitte, ${m.split.metrik.fehlalarme} Fehlschnitte` : '';
    console.log(`${fall.id} ${variante.padEnd(7)} ${[sp, typTreffer, m.posteingang ? `Posteingang verfehlt ${m.posteingang.verfehlt.length}` : '', regelwerk ? `Regelwerk verfehlt ${regelwerk.verfehlt.length}, Fehlalarm ${regelwerk.fehlalarm.length}` : ''].filter(Boolean).join(' · ')} (${m.dauerSek}s)`);
   } catch (err) {
    // Ein Fehler in einem Fall soll den Lauf nicht abbrechen — protokollieren, weiter.
    const text = err instanceof Error ? err.message : String(err);
    console.error(`${fall.id} ${variante}: FEHLER ${text}`);
    ergebnisse.push({ fall: fall.id, titel: fall.titel, gruppe: fall.gruppe, variante, seiten: erw.seiten, regelwerk, dauerSek: 0, fehler: text });
   }
    await Bun.write(join(ausgabe, 'ergebnis.json'), JSON.stringify({ lauf, modell: MODELL, promptStand: WOHNGELD_PROMPT_VERSION, endeZuEnde, ergebnisse }, null, 2));
  }
}

await Bun.write(join(ausgabe, 'bericht.md'), erzeugeBericht({ lauf, modell: MODELL, endeZuEnde: endeZuEnde || erkennung === 'profil', ergebnisse, erkennung }));
console.log(`\nErgebnis: ${join(ausgabe, 'ergebnis.json')}\nBericht:  ${join(ausgabe, 'bericht.md')}`);
process.exit(0);
