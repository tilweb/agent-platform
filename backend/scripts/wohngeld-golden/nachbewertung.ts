/**
 * Golden-Dataset — Nachbewertung OHNE KI: prüft gespeicherte Profil-Ergebnisse eines früheren
 * Messlaufs (`out/messung/cache/profil`) und den korrekt erfassten Fall (Regelwerk) mit den
 * AKTUELLEN Regeln. Für Vorher/Nachher-Vergleiche von Regeländerungen ohne neue Extraktion.
 *
 * Aufruf im backend/-Ordner:
 *   bun run scripts/wohngeld-golden/nachbewertung.ts --lauf 2026-09-24T05-40-28 [--json out.json]
 *   bun run scripts/wohngeld-golden/nachbewertung.ts --nur-regelwerk
 *
 * Zuordnung Cache-Datei → Fall/Variante: der Cache-Schlüssel hängt am Profil-Stand und ist nicht
 * umkehrbar. Die Dateien eines Laufs entstehen aber der Reihe nach (Fälle sequentiell) zwischen
 * Laufbeginn und letzter Schreibung von `ergebnis.json`; jede Zuordnung wird zusätzlich über die
 * im Lauf gefundenen Abschnittsgrenzen (`split.gefunden`) geprüft. Passt etwas nicht, bricht das
 * Skript ab, statt falsch zu zählen.
 *
 * Ausgabe: je Stufe Treffer/Verfehlt/Fehlalarm, Fehlalarme je Regel getrennt nach Typ
 * (Anforderung = geht an den Antragsteller, Hinweis = nur an die Sachbearbeitung).
 */
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pruefeVorgang } from '../../src/apps/antragspruefung/wohngeld/checker';
import type { PruefBefund } from '../../src/apps/antragspruefung/wohngeld/types';
import { posteingangSnapshot, regelwerkSnapshot, type ErwartungKurz, type ExtraktionKurz, type FallKurz } from './snapshot';
import { werteBefundeAus } from './vergleich';

const TOOLS = process.env.WOHNGELD_GOLDEN_DIR ?? join(import.meta.dir, '..', '..', '..', 'tools', 'wohngeld-golden');
const MESSUNG = join(TOOLS, 'out', 'messung');
const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const laeufe = argv.flatMap((a, i) => (a === '--lauf' ? [argv[i + 1]!] : []));
const nurRegelwerk = argv.includes('--nur-regelwerk');
const jsonAus = opt('json');
/** `--detail`: Belegtexte aller Fehlalarme ausgeben (Ursachenanalyse). */
const detail = argv.includes('--detail');
/** Regeln, deren Typ vom Befund abhängt (Anforderung nur bei sicherer Erkennung). */
const TYP_WECHSEL = new Set(['plausi-mietvertrag-unsigniert']);
const MIET_ARTEN: ReadonlySet<string> = new Set(['mietvertrag', 'untermietvertrag', 'heimvertrag', 'mieterhoehung', 'vermieterbescheinigung']);

interface Erwartung extends ErwartungKurz {
  pruefung: { befunde: string[]; standardbefunde: string[]; appVermutlichZusaetzlich: Array<{ regelId: string }> };
}
interface Zeile { fall: string; variante: string; befunde: Array<{ regelId: string; typ: string; titel: string; belegtext: string }>; treffer: string[]; verfehlt: string[]; bekannt: string[]; fehlalarm: string[] }

const { FAELLE } = (await import(join(TOOLS, 'src', 'faelle', 'index.ts'))) as { FAELLE: Array<FallKurz & { id: string }> };
const erwartung = new Map<string, Erwartung>();
for (const f of FAELLE) erwartung.set(f.id, (await Bun.file(join(TOOLS, 'expected', `${f.id}.expected.json`)).json()) as Erwartung);

const basisId = (r: string) => r.split(':')[0]!;
function bewerte(fall: string, variante: string, befunde: PruefBefund[]): Zeile {
  const erw = erwartung.get(fall)!;
  const a = werteBefundeAus(befunde.map((b) => b.regelId), erw.pruefung);
  return { fall, variante, befunde: befunde.map((b) => ({ regelId: basisId(b.regelId), typ: b.typ, titel: b.titel, belegtext: b.belegtext })), ...a };
}

/** Typ einer Regel im Fall: Anforderung, sobald eine Meldung dieser Regel Anforderung ist. */
function typVon(z: Zeile, regel: string): 'anforderung' | 'info' {
  return z.befunde.some((b) => b.regelId === regel && b.typ === 'anforderung') ? 'anforderung' : 'info';
}

function zusammenfassung(titel: string, zeilen: Zeile[]) {
  const sum = (k: 'treffer' | 'verfehlt' | 'fehlalarm' | 'bekannt') => zeilen.reduce((s, z) => s + z[k].length, 0);
  const jeRegel = new Map<string, { anforderung: number; info: number; faelle: string[] }>();
  for (const z of zeilen) for (const r of z.fehlalarm) {
    const e = jeRegel.get(r) ?? { anforderung: 0, info: 0, faelle: [] };
    e[typVon(z, r)]++;
    e.faelle.push(`${z.fall}${z.variante === 'regelwerk' ? '' : z.variante === 'digital' ? '/d' : '/s'}`);
    jeRegel.set(r, e);
  }
  const fehlAnf = [...jeRegel.values()].reduce((s, e) => s + e.anforderung, 0);
  console.log(`\n## ${titel}\n`);
  console.log(`Treffer ${sum('treffer')} · verfehlt ${sum('verfehlt')} · Fehlalarme ${sum('fehlalarm')} (davon Anforderung ${fehlAnf}, Hinweis ${sum('fehlalarm') - fehlAnf}) · bekannte Übermeldungen ${sum('bekannt')}`);
  const verfehlt = zeilen.flatMap((z) => z.verfehlt.map((r) => `${z.fall}${z.variante === 'regelwerk' ? '' : `/${z.variante[0]}`} ${r}`));
  if (verfehlt.length) console.log(`Verfehlt: ${verfehlt.join('; ')}`);
  console.log('\n| Regel | Fehlalarme | davon Anforderung | davon Hinweis | Fälle |\n|---|---|---|---|---|');
  for (const [r, e] of [...jeRegel.entries()].sort((a, b) => (b[1].anforderung + b[1].info) - (a[1].anforderung + a[1].info))) {
    console.log(`| \`${r}\` | ${e.anforderung + e.info} | ${e.anforderung} | ${e.info} | ${e.faelle.join(', ')} |`);
  }
  // Treffer, die nur noch als Hinweis gemeldet werden (Typwechsel sichtbar machen).
  const trefferHinweis = zeilen.flatMap((z) => z.treffer.filter((r) => TYP_WECHSEL.has(r) && z.befunde.some((b) => b.regelId === r) && typVon(z, r) === 'info').map((r) => `${z.fall}${z.variante === 'regelwerk' ? '' : `/${z.variante[0]}`} ${r}`));
  if (trefferHinweis.length) console.log(`\nTreffer als Hinweis (info): ${trefferHinweis.join('; ')}`);
  if (detail) {
    console.log('\nFehlalarme im Einzelnen:');
    for (const z of zeilen) for (const r of z.fehlalarm) for (const b of z.befunde.filter((x) => x.regelId === r)) {
      console.log(`- ${z.fall}${z.variante === 'regelwerk' ? '' : `/${z.variante[0]}`} \`${r}\` (${b.typ}): ${b.titel} — ${b.belegtext}`);
    }
  }
  return { titel, treffer: sum('treffer'), verfehlt: sum('verfehlt'), fehlalarm: sum('fehlalarm'), fehlalarmAnforderung: fehlAnf, bekannt: sum('bekannt'), jeRegel: Object.fromEntries(jeRegel), zeilen };
}

const ausgabe: unknown[] = [];

// ── Regelwerk (korrekt erfasster Fall, erwartete Werte) ─────────────────────
const regelwerk = FAELLE.map((f) => bewerte(f.id, 'regelwerk', pruefeVorgang(regelwerkSnapshot(f, erwartung.get(f.id)!))));
ausgabe.push(zusammenfassung(`Regelwerk (${FAELLE.length} Fälle, ohne KI)`, regelwerk));

// ── Posteingang aus gespeicherten Profil-Ergebnissen ────────────────────────
if (!nurRegelwerk) {
  const cacheDir = join(MESSUNG, 'cache', 'profil');
  const dateien = await Promise.all((await readdir(cacheDir)).map(async (n) => ({ pfad: join(cacheDir, n), mtime: (await stat(join(cacheDir, n))).mtimeMs })));
  for (const lauf of laeufe.length ? laeufe : ['2026-09-24T05-40-28']) {
    const ergebnisPfad = join(MESSUNG, lauf, 'ergebnis.json');
    const ergebnis = (await Bun.file(ergebnisPfad).json()) as { ergebnisse: Array<{ fall: string; variante: string; split?: { gefunden: Array<{ von: number; bis: number }>; cache: boolean } }> };
    const beginn = Date.parse(`${lauf.slice(0, 10)}T${lauf.slice(11).replace(/-/g, ':')}Z`);
    const ende = (await stat(ergebnisPfad)).mtimeMs + 1000;
    const imLauf = dateien.filter((d) => d.mtime >= beginn && d.mtime <= ende).sort((a, b) => a.mtime - b.mtime);
    const neu = ergebnis.ergebnisse.filter((e) => e.split && !e.split.cache);
    if (imLauf.length !== neu.length) throw new Error(`${lauf}: ${imLauf.length} Cache-Dateien im Zeitfenster, ${neu.length} neu erzeugte Ergebnisse erwartet`);
    const zeilen: Zeile[] = [];
    for (const [i, e] of neu.entries()) {
      const wert = (await Bun.file(imLauf[i]!.pfad).json()) as { abschnitte: Array<ExtraktionKurz & { von: number; bis: number; abschnitt?: string }> };
      const grenzen = wert.abschnitte.map((a) => `${a.von}-${a.bis}`).join(',');
      const erwartetGrenzen = e.split!.gefunden.map((b) => `${b.von}-${b.bis}`).join(',');
      if (grenzen !== erwartetGrenzen) throw new Error(`${lauf} ${e.fall}/${e.variante}: Cache-Datei ${imLauf[i]!.pfad} passt nicht (${grenzen} ≠ ${erwartetGrenzen})`);
      // Ergebnisse vor der Profil-Vorlage 2026-09-28 tragen `mietdokument` noch nicht in der Analyse; die App
      // setzt es heute aus dem erkannten Abschnitt (dp-erkennung) — gleich nachziehen, damit alte und neue
      // Läufe vergleichbar bleiben.
      const snap = posteingangSnapshot(wert.abschnitte.map((a) => ({
        typ: a.typ, stammdaten: a.stammdaten, identitaet: a.identitaet,
        analyse: a.analyse && !a.analyse.mietdokument && MIET_ARTEN.has(a.abschnitt ?? '') ? { ...a.analyse, mietdokument: a.abschnitt as never } : a.analyse,
      })));
      zeilen.push(bewerte(e.fall, e.variante, pruefeVorgang(snap)));
    }
    ausgabe.push(zusammenfassung(`Posteingang aus gespeicherten Profil-Ergebnissen, Lauf ${lauf} (${zeilen.length} PDFs, ohne KI)`, zeilen));
  }
}

if (jsonAus) await Bun.write(jsonAus, JSON.stringify(ausgabe, null, 2));
process.exit(0);
