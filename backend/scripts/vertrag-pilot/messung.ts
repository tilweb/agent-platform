/**
 * Messung der DP-Strategie `contract-structured` auf echten Verträgen.
 *
 * Verträge und Erwartungswerte enthalten Kundendaten und liegen NICHT im Repo
 * (siehe tools/vertrag-golden/README.md). Zuordnung V<n> → Datei in
 * tools/vertrag-golden/erwartet/zuordnung.json.
 *
 * Aufruf (im backend/, PATH mit poppler):
 *   bun run scripts/vertrag-pilot/messung.ts                     # alle Stufen, alle Verträge
 *   bun run scripts/vertrag-pilot/messung.ts --vertraege V1,V4   # Auswahl
 *   bun run scripts/vertrag-pilot/messung.ts --stufe struktur     # nur Transkription + Strukturbaum
 *   bun run scripts/vertrag-pilot/messung.ts --ohne-cache         # Transkription neu
 * Optionen: --ordner <pfad> (Default ~/Downloads/Vertragsbeispiele-Ehinger-END), --parallel <n> (Default 4).
 *
 * Transkriptionen werden je Seite (Bild-Hash + Prompt-Hash) unter
 * tools/vertrag-golden/out/cache/ gespeichert; Ergebnisse unter out/ergebnis/.
 */

import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { renderPdfToImages, pdfToLayoutText } from '../../src/services/extraction/pdf';
import { extractionVisionDpi } from '../../src/services/extraction/defaults';
import { extractionModelOverride } from '../../src/extraction/model';
import { baueStruktur } from '../../src/services/extraction/contract/struktur';
import { TRANSKRIPTION_SYSTEM, textlayerJeSeite, transkribiereSeite, type SeitenBild } from '../../src/services/extraction/contract/transkription';
import { parallelBegrenzt, type ModellKontext } from '../../src/services/extraction/contract/modell';
import { werteAus, type ErweiterungsFeld } from '../../src/services/extraction/contract/auswertung';
import { konsolidiere } from '../../src/services/extraction/contract/konsolidierung';
import type { Klausel, SeitenTranskript, VertragsAuswertung } from '../../src/services/extraction/contract/types';

const GOLDEN = join(import.meta.dir, '..', '..', '..', 'tools', 'vertrag-golden');
const CACHE = join(GOLDEN, 'out', 'cache');
const ERGEBNIS = join(GOLDEN, 'out', 'ergebnis');

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const flag = (n: string) => argv.includes(`--${n}`);
const ordner = opt('ordner') ?? join(homedir(), 'Downloads', 'Vertragsbeispiele-Ehinger-END');
const auswahl = opt('vertraege')?.split(',').map((s) => s.trim().toUpperCase());
const stufe = opt('stufe') ?? 'alle';
const parallel = Number(opt('parallel') ?? 4);
const ohneCache = flag('ohne-cache');

const sha = (b: Uint8Array | string) => new Bun.CryptoHasher('sha256').update(b).digest('hex');
const PROMPT_HASH = sha(TRANSKRIPTION_SYSTEM).slice(0, 10);
const kontext: ModellKontext = { userId: 'vertrag-pilot', modelOverride: extractionModelOverride() };

async function transkribiereMitCache(bild: SeitenBild, gesamt: number): Promise<{ t: SeitenTranskript; cache: boolean }> {
  const pfad = join(CACHE, `${sha(bild.png).slice(0, 16)}-${PROMPT_HASH}.json`);
  const f = Bun.file(pfad);
  if (!ohneCache && await f.exists()) {
    const t = await f.json() as SeitenTranskript;
    if (!t.fehler) return { t: { ...t, seite: bild.seite }, cache: true };
  }
  const t = await transkribiereSeite(kontext, bild, gesamt);
  if (!t.fehler) await Bun.write(pfad, JSON.stringify(t));
  return { t, cache: false };
}

export interface StrukturErgebnis {
  id: string;
  seiten: number;
  transkripte: SeitenTranskript[];
  klauseln: Klausel[];
  sekundenTranskription: number;
  ausCache: number;
}

export async function strukturFuer(id: string, datei: string): Promise<StrukturErgebnis> {
  const bytes = Buffer.from(await Bun.file(join(ordner, datei)).arrayBuffer());
  const bilder = await renderPdfToImages(bytes, { dpi: extractionVisionDpi(), maxPages: 150 });
  let layout: string[] = [];
  try { layout = textlayerJeSeite(await pdfToLayoutText(bytes)); } catch { /* kein Textlayer */ }
  const t0 = performance.now();
  let ausCache = 0;
  const transkripte = await parallelBegrenzt(bilder, parallel, async (b) => {
    const r = await transkribiereMitCache({ seite: b.pageNumber, png: b.pngBuffer, hilfstext: layout[b.pageNumber - 1] }, bilder.length);
    if (r.cache) ausCache += 1;
    process.stdout.write(r.t.fehler ? 'x' : r.cache ? '·' : '.');
    return r.t;
  });
  process.stdout.write('\n');
  return { id, seiten: bilder.length, transkripte, klauseln: baueStruktur(transkripte), sekundenTranskription: (performance.now() - t0) / 1000, ausCache };
}

function strukturBericht(e: StrukturErgebnis): string {
  const rollen = new Map<string, number>();
  for (const t of e.transkripte) rollen.set(t.rolle, (rollen.get(t.rolle) ?? 0) + 1);
  const abschnitte = e.klauseln.filter((k) => k.ebene === 1);
  const absaetze = e.klauseln.filter((k) => k.ebene > 1);
  const ueberSeiten = e.klauseln.filter((k) => k.seiten[0] !== k.seiten[1]);
  const fehler = e.transkripte.filter((t) => t.fehler);
  const markierungen = e.transkripte.map((t) => t.text).join('\n');
  const zaehle = (re: RegExp) => (markierungen.match(re) ?? []).length;
  return [
    `${e.id}: ${e.seiten} S. (${e.ausCache} aus Cache, ${e.sekundenTranskription.toFixed(0)} s) · Rollen ${[...rollen].map(([r, n]) => `${r} ${n}`).join(', ')}`,
    `  Abschnitte ${abschnitte.length}: ${abschnitte.map((k) => k.id).join(' ')}`,
    `  Absätze/Unterpunkte ${absaetze.length} (implizit ${absaetze.filter((k) => k.implizit).length}) · seitenübergreifend ${ueberSeiten.length}: ${ueberSeiten.slice(0, 12).map((k) => `${k.id}[${k.seiten.join('-')}]`).join(' ')}`,
    `  Auszeichnung: gestrichen ${zaehle(/~~[^~]+~~/g)} · [x] ${zaehle(/\[x\]/gi)} · [ ] ${zaehle(/\[ \]/g)} · Handschrift ${zaehle(/\{\{hs:/g)} · Unterschrift ${zaehle(/\{\{unterschrift:/g)} · Stempel ${zaehle(/\{\{stempel:/g)}`,
    ...(fehler.length ? [`  FEHLER Seiten ${fehler.map((t) => `${t.seite} (${t.fehler})`).join(', ')}`] : []),
  ].join('\n');
}

/** Beispiel-Erweiterung „Ladeinfrastruktur" (Profilfelder, wie sie im DP-Projekt gepflegt würden). */
export const LADE_FELDER: Record<string, ErweiterungsFeld> = {
  standorte: { type: 'list', label: 'Standorte', description: 'Standorte der Ladeinfrastruktur, meist im Rubrum oder in einer Anlage', item_fields: {
    name: { type: 'text', label: 'Standortname' }, adresse: { type: 'text', label: 'Adresse' }, ladepunkte_anzahl: { type: 'number', label: 'Anzahl Ladepunkte am Standort' },
  } },
  ladepunkte: { type: 'list', label: 'Ladepunkte', description: 'Je Ladepunkt eine Zeile, meist Tabelle in Anlage 1', item_fields: {
    evse_id: { type: 'text', label: 'EVSE-ID' }, hersteller: { type: 'text', label: 'Hersteller' }, modell: { type: 'text', label: 'Modell/Typ' }, leistung: { type: 'text', label: 'Leistung / AC/DC' }, standort: { type: 'text', label: 'Standort' },
  } },
  entgelt_je_ladepunkt_monat: { type: 'number', label: 'Entgelt je Ladepunkt und Monat (EUR)' },
  rueckverguetung: { type: 'text', label: 'Rückvergütung/Erlösbeteiligung an den Kunden (Satz und Basis)' },
  backend: { type: 'text', label: 'Backend-/Abrechnungssystem' },
  wartungsintervall: { type: 'text', label: 'Wartungsintervall' },
};

function auswertungsBericht(id: string, v: VertragsAuswertung, sek: number, aufrufe: number, data: Record<string, unknown>): string {
  const status = new Map<string, number>();
  for (const w of Object.values(v.katalog)) status.set(w!.status, (status.get(w!.status) ?? 0) + 1);
  const typen = new Map<string, number>();
  for (const e of v.inventar) typen.set(e.typ, (typen.get(e.typ) ?? 0) + 1);
  const befunde = new Map<string, number>();
  for (const b of v.befunde) befunde.set(b.typ, (befunde.get(b.typ) ?? 0) + 1);
  const k = v.katalog;
  const kurz = (x: unknown) => JSON.stringify(x ?? null).slice(0, 220);
  return [
    `${id} Auswertung (${sek.toFixed(0)} s, ${aufrufe} Aufrufe) · Katalog ${[...status].map(([s, n]) => `${s} ${n}`).join(', ')}`,
    `  Parteien ${kurz((k.parteien?.wert as Array<{ rolle?: string; name?: string }> | undefined)?.map((p) => `${p.rolle}: ${p.name}`))}`,
    `  Art ${kurz(k.vertragsart?.wert)} · Beginn ${kurz(k.beginn?.wert)} [${k.beginn?.klauseln.join(',')}]`,
    `  Laufzeit ${kurz(k.laufzeit?.wert)} · Verlängerung ${kurz(k.verlaengerung?.wert)}`,
    `  Kündigung ${kurz(k.kuendigung?.wert)} [${k.kuendigung?.klauseln.join(',')}]`,
    `  Unterschriften ${kurz(k.unterschriften?.wert)}`,
    `  Inventar ${v.inventar.length} (${[...typen].map(([t, n]) => `${t} ${n}`).join(', ')}) · Fristen ${v.fristen.length} · Verweise ${v.verweise.length} (offen ${v.verweise.filter((x) => !x.ziel).length}) · Gültigkeit ${v.gueltigkeit.length}`,
    `  Befunde ${[...befunde].map(([t, n]) => `${t} ${n}`).join(', ') || '–'}`,
    ...v.befunde.filter((b) => b.typ !== 'verarbeitung').map((b) => `    · ${b.typ}: ${b.text.slice(0, 160)} [${b.klauseln.join(',')}]`),
    ...v.befunde.filter((b) => b.typ === 'verarbeitung').map((b) => `    ! ${b.text.slice(0, 200)}`),
    `  Erweiterung ${kurz(data).slice(0, 400)}`,
  ].join('\n');
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  await mkdir(ERGEBNIS, { recursive: true });
  const zuordnung = await Bun.file(join(GOLDEN, 'erwartet', 'zuordnung.json')).json() as Record<string, string>;
  const ids = Object.keys(zuordnung).filter((id) => !auswahl || auswahl.includes(id));
  console.log(`Verträge: ${ids.join(', ')} · Modell ${kontext.modelOverride?.providerId}/${kontext.modelOverride?.modelId} · ${extractionVisionDpi()} dpi · parallel ${parallel}`);
  for (const id of ids) {
    const e = await strukturFuer(id, zuordnung[id]!);
    await Bun.write(join(ERGEBNIS, `${id}-struktur.json`), JSON.stringify(e, null, 2));
    console.log(strukturBericht(e));
    if (stufe === 'struktur') continue;
    const t0 = performance.now();
    const aw = await werteAus(kontext, e.klauseln, { felder: LADE_FELDER, parallel });
    const { vertrag, erweiterung } = konsolidiere(e.transkripte, e.klauseln, aw);
    const sek = (performance.now() - t0) / 1000;
    await Bun.write(join(ERGEBNIS, `${id}-vertrag.json`), JSON.stringify({ vertrag, erweiterung, sekunden: sek, aufrufe: aw.aufrufe }, null, 2));
    console.log(auswertungsBericht(id, vertrag, sek, aw.aufrufe, erweiterung.data));
  }
}

if (import.meta.main) { await main(); process.exit(0); }
