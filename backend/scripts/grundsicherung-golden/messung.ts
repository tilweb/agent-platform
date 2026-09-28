/**
 * Grundsicherung-Golden — Messung der Posteingang-Erkennung gegen die Goldfälle.
 *
 * Je Fall: Sammel-PDF → `erkenneDokumente` (DP-Segmentprofil „Grundsicherung-Eingang", echtes
 * Modell, Profil wie die App über `ladeProfil`) → Vergleich der Abschnitte (Typ, Seiten) und
 * Kernfelder mit expected.json → Posteingang-Nachbau (reine App-Funktionen, ohne DB) →
 * Regel-Engine → Befunde gegen Spec und gegen die Befunde aus den Soll-Werten.
 *
 * Aufruf im backend/-Ordner (vorher erzeuge.ts):
 *   bun run scripts/grundsicherung-golden/messung.ts               # alle Fälle, Cache nutzen
 *   bun run scripts/grundsicherung-golden/messung.ts GS02 --ohne-cache
 *   Optionen: --vorlage (Profil-Vorlage im Speicher statt DB-Profil), --ohne-cache
 *
 * Die App-Abbildung (mappeAbschnitt + Wiederkehr über Auszüge) wird bei jedem Lauf aus den
 * gecachten Rohwerten neu berechnet — Mapping-Änderungen kosten keine Modellaufrufe.
 *
 * Modellantworten werden je PDF-Hash + Profil-Fingerabdruck + Modell gecacht
 * (tools/output/grundsicherung-golden/messung/cache) — Nachläufe ohne Kosten.
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  erkenneDokumente, ladeProfil, mappeAbschnitt, markiereWiederkehrendeEingaenge, vorlagenHash, type GeladenesProfil,
} from '../../src/apps/grundsicherung/dp-erkennung';
import { buildGrundsicherungEingangProject, GRUNDSICHERUNG_PROFIL_VORLAGE_STAND } from '../../src/extraction/templates/grundsicherung-eingang';
import { extractionModelLabel } from '../../src/extraction/model';
import { stableHash } from '../../src/extraction/learning/snapshot';
import { mitTokenMessung, type TokenMessung } from '../../src/services/llm/token-meter';
import { AUSGABE, type Erwartung } from './erzeuge';
import {
  befundeFuer, ordneZu, posteingangSnapshot, splitMetrik, vergleicheFelder,
  type AbschnittKurz, type FeldErgebnis, type SplitMetrik,
} from './vergleich';

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const filter = argv.filter((a) => !a.startsWith('--')).map((a) => a.toUpperCase());
const CACHE = join(AUSGABE, 'messung', 'cache');
const MODELL = extractionModelLabel();
const sha = (b: Uint8Array | string) => new Bun.CryptoHasher('sha256').update(b).digest('hex');

interface LaufRoh {
  abschnitte: Array<AbschnittKurz & { von: number; bis: number; abschnitt: string; konfidenz: number; rohwerte: Record<string, unknown> }>;
  hinweise: string[];
  tokens: TokenMessung;
  dauerMs: number;
}

export interface DokumentErgebnis {
  nr: number; typErwartet: string; seiten: string; erkannt: string | null; typOk: boolean; bereichOk: boolean;
  felder: FeldErgebnis[]; personOk?: boolean;
}
export interface FallErgebnis {
  fall: string; titel: string; seiten: number; cache: boolean;
  split: SplitMetrik; abschnitteKorrekt: number; typKorrekt: number; dokumente: DokumentErgebnis[];
  felderOk: number; felderGesamt: number;
  personen: { ok: number; gesamt: number };
  befunde: { app: string[]; spec: string[]; specGefunden: string[]; soll: string[]; verfehlt: string[]; zusaetzlich: string[] };
  tokens: TokenMessung; dauerSek: number; hinweise: string[];
  erkannt: Array<{ von: number; bis: number; typ: string; konfidenz: number }>;
}

async function ladeMessprofil(): Promise<GeladenesProfil> {
  if (flag('vorlage')) return { profil: buildGrundsicherungEingangProject(), beispiele: [], quelle: 'vorlage' };
  return ladeProfil();
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '—');
const fmt = (v: unknown) => (v === undefined ? '—' : JSON.stringify(v));

export function berichtMarkdown(lauf: string, profil: string, ergebnisse: FallErgebnis[]): string {
  const z: string[] = [];
  z.push(`# Grundsicherung-Golden — Messlauf ${lauf}`, '', `Modell \`${MODELL}\` · Profil ${profil}`, '');
  z.push('| Fall | Seiten | Abschnitte korrekt | Typ korrekt | Schnitte | Fehlschnitte | Felder korrekt | Person zugeordnet | Spec-Befunde | ggü. Soll verfehlt / zusätzlich | Tokens (Aufrufe) | Dauer |');
  z.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const e of ergebnisse) {
    z.push(`| ${e.fall} | ${e.seiten} | ${e.abschnitteKorrekt}/${e.dokumente.length} | ${e.typKorrekt}/${e.dokumente.length} | ${e.split.treffer}/${e.split.erwarteteSchnitte} | ${e.split.fehlschnitte} | ${e.felderOk}/${e.felderGesamt} (${pct(e.felderOk, e.felderGesamt)}) | ${e.personen.ok}/${e.personen.gesamt} | ${e.befunde.specGefunden.length}/${e.befunde.spec.length} | ${e.befunde.verfehlt.length} / ${e.befunde.zusaetzlich.length} | ${(e.tokens.promptTokens + e.tokens.completionTokens).toLocaleString('de-DE')} (${e.tokens.aufrufe}) | ${e.dauerSek} s${e.cache ? ' (Cache)' : ''} |`);
  }
  const sum = (f: (e: FallErgebnis) => number) => ergebnisse.reduce((s, e) => s + f(e), 0);
  z.push(`| **Summe** | ${sum((e) => e.seiten)} | ${sum((e) => e.abschnitteKorrekt)}/${sum((e) => e.dokumente.length)} | ${sum((e) => e.typKorrekt)}/${sum((e) => e.dokumente.length)} | ${sum((e) => e.split.treffer)}/${sum((e) => e.split.erwarteteSchnitte)} | ${sum((e) => e.split.fehlschnitte)} | ${sum((e) => e.felderOk)}/${sum((e) => e.felderGesamt)} (${pct(sum((e) => e.felderOk), sum((e) => e.felderGesamt))}) | ${sum((e) => e.personen.ok)}/${sum((e) => e.personen.gesamt)} | ${sum((e) => e.befunde.specGefunden.length)}/${sum((e) => e.befunde.spec.length)} | ${sum((e) => e.befunde.verfehlt.length)} / ${sum((e) => e.befunde.zusaetzlich.length)} | ${sum((e) => e.tokens.promptTokens + e.tokens.completionTokens).toLocaleString('de-DE')} (${sum((e) => e.tokens.aufrufe)}) | ${Math.round(sum((e) => e.dauerSek))} s |`);
  for (const e of ergebnisse) {
    z.push('', `## ${e.fall} — ${e.titel}`, '');
    z.push(`Erkannte Abschnitte: ${e.erkannt.map((a) => `${a.typ} ${a.von}–${a.bis}`).join(' · ')}`, '');
    if (e.split.verfehlt.length || e.split.zusaetzlich.length) z.push(`Split: verfehlte Schnitte vor Seite ${e.split.verfehlt.join(', ') || '—'}; Fehlschnitte vor Seite ${e.split.zusaetzlich.join(', ') || '—'}`, '');
    z.push('| # | erwartet | Seiten | erkannt | Felder | Abweichungen |', '|---|---|---|---|---|---|');
    for (const d of e.dokumente) {
      const abw = d.felder.filter((f) => !f.ok).map((f) => `\`${f.pfad}\` soll ${fmt(f.soll)}, ist ${fmt(f.ist)}`).join('<br>');
      z.push(`| ${d.nr} | ${d.typErwartet} | ${d.seiten} | ${d.erkannt ?? '—'}${d.bereichOk ? '' : ' (Bereich abweichend)'}${d.personOk === false ? ' · Person falsch' : ''} | ${d.felder.filter((f) => f.ok).length}/${d.felder.length} | ${abw || '—'} |`);
    }
    z.push('', `Befunde App: ${e.befunde.app.join(', ') || '—'}`);
    z.push(`Spec erwartet: ${e.befunde.spec.map((b) => (e.befunde.specGefunden.includes(b) ? b : `**${b} (fehlt)**`)).join(', ')}`);
    z.push(`Gegenüber Soll-Werten verfehlt: ${e.befunde.verfehlt.join(', ') || '—'} · zusätzlich: ${e.befunde.zusaetzlich.join(', ') || '—'}`);
    if (e.hinweise.length) z.push(`Hinweise DP: ${e.hinweise.join(' | ')}`);
  }
  return z.join('\n') + '\n';
}

if (import.meta.main) {
  const profil = await ladeMessprofil();
  const fingerabdruck = stableHash([vorlagenHash(profil.profil), profil.beispiele.map((b) => b.id)]).slice(0, 16);
  const lauf = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const profilText = `${profil.quelle} (Vorlage ${GRUNDSICHERUNG_PROFIL_VORLAGE_STAND}, Fingerabdruck ${fingerabdruck}, ${profil.beispiele.length} Lernbeispiele)`;
  console.log(`Messlauf ${lauf} · Modell ${MODELL} · Profil ${profilText}`);

  const faelle = (await Array.fromAsync(new Bun.Glob('GS*/expected.json').scan({ cwd: AUSGABE }))).sort()
    .filter((p) => !filter.length || filter.includes(p.split('/')[0]!));
  const ergebnisse: FallErgebnis[] = [];
  for (const rel of faelle) {
    const erw = (await Bun.file(join(AUSGABE, rel)).json()) as Erwartung;
    const bytes = new Uint8Array(await Bun.file(join(AUSGABE, erw.fall, erw.pdf)).arrayBuffer());
    const cachePfad = join(CACHE, `${sha(`${sha(bytes)}|${fingerabdruck}|${MODELL}`).slice(0, 32)}.json`);
    let roh: LaufRoh;
    let cache = false;
    if (!flag('ohne-cache') && (await Bun.file(cachePfad).exists())) {
      roh = (await Bun.file(cachePfad).json()) as LaufRoh;
      cache = true;
    } else {
      console.log(`${erw.fall}: Erkennung läuft (${erw.seiten} Seiten) …`);
      const { ergebnis, messung, dauerMs } = await mitTokenMessung(() => erkenneDokumente(bytes, { filename: erw.pdf, profil }));
      roh = {
        abschnitte: ergebnis.abschnitte.map((a) => ({
          von: a.seiteVon, bis: a.seiteBis, abschnitt: a.abschnitt, konfidenz: a.konfidenz, typ: a.typ, analyse: a.analyse,
          ...(a.stammdaten ? { stammdaten: a.stammdaten } : {}), ...(a.identitaet ? { identitaet: a.identitaet } : {}), rohwerte: a.rohwerte,
        })),
        hinweise: ergebnis.hinweise, tokens: messung, dauerMs,
      };
      await mkdir(CACHE, { recursive: true });
      await Bun.write(cachePfad, JSON.stringify(roh));
    }

    // Abbildung aus den gecachten Profil-Rohwerten neu berechnen: Mapping-Änderungen in
    // dp-erkennung.ts sind so ohne neue Modellaufrufe messbar.
    const erkannt = markiereWiederkehrendeEingaenge(roh.abschnitte.map((a) => {
      const m = mappeAbschnitt(a.abschnitt, a.rohwerte);
      return { ...a, typ: m.typ, analyse: m.analyse, stammdaten: m.stammdaten, identitaet: m.identitaet };
    }));
    const zu = ordneZu(erw.dokumente.map((d) => ({ von: d.seiteVon, bis: d.seiteBis, typ: d.typ })), erkannt);
    const snap = posteingangSnapshot(erkannt);
    const at = snap.personen.find((p) => p.rolle === 'antragsteller')?.id;
    const PERSONEN_DOKS = new Set(['personalausweis', 'rentenbescheid', 'rentenanpassungsmitteilung', 'kv_pv_nachweis', 'kontoauszug', 'vermoegensnachweis']);
    let pOk = 0, pGes = 0;
    const dokumente: DokumentErgebnis[] = erw.dokumente.map((d, i) => {
      const j = zu[i]!;
      const a = j >= 0 ? erkannt[j] : undefined;
      const felder = vergleicheFelder(d.kern, a);
      let personOk: boolean | undefined;
      if (PERSONEN_DOKS.has(d.typ)) {
        pGes++;
        personOk = !!a && a.typ === d.typ && !!at && snap.zuordnung[j] === at;
        if (personOk) pOk++;
      }
      return {
        nr: d.nr, typErwartet: d.typ, seiten: `${d.seiteVon}–${d.seiteBis}`, erkannt: a ? `${a.typ} ${a.von}–${a.bis}` : null,
        typOk: a?.typ === d.typ, bereichOk: !!a && a.von === d.seiteVon && a.bis === d.seiteBis, felder, personOk,
      };
    });
    const app = befundeFuer(erkannt);
    const e: FallErgebnis = {
      fall: erw.fall, titel: erw.titel, seiten: erw.seiten, cache,
      split: splitMetrik(erw.dokumente.map((d) => ({ von: d.seiteVon, bis: d.seiteBis })), erkannt),
      abschnitteKorrekt: dokumente.filter((d) => d.typOk && d.bereichOk).length,
      typKorrekt: dokumente.filter((d) => d.typOk).length,
      dokumente,
      felderOk: dokumente.reduce((s, d) => s + d.felder.filter((f) => f.ok).length, 0),
      felderGesamt: dokumente.reduce((s, d) => s + d.felder.length, 0),
      personen: { ok: pOk, gesamt: pGes },
      befunde: {
        app, spec: erw.befunde.spec, specGefunden: erw.befunde.spec.filter((b) => app.includes(b)), soll: erw.befunde.soll,
        verfehlt: erw.befunde.soll.filter((b) => !app.includes(b)), zusaetzlich: app.filter((b) => !erw.befunde.soll.includes(b)),
      },
      tokens: roh.tokens, dauerSek: Math.round(roh.dauerMs / 100) / 10, hinweise: roh.hinweise,
      erkannt: erkannt.map((a) => ({ von: a.von, bis: a.bis, typ: a.typ, konfidenz: a.konfidenz })),
    };
    ergebnisse.push(e);
    console.log(`${e.fall}: Abschnitte ${e.abschnitteKorrekt}/${e.dokumente.length} · Typ ${e.typKorrekt}/${e.dokumente.length} · Felder ${e.felderOk}/${e.felderGesamt} · Person ${pOk}/${pGes} · Spec-Befunde ${e.befunde.specGefunden.length}/${e.befunde.spec.length} · ggü. Soll verfehlt ${e.befunde.verfehlt.length}, zusätzlich ${e.befunde.zusaetzlich.length} · ${(e.tokens.promptTokens + e.tokens.completionTokens).toLocaleString('de-DE')} Tokens/${e.tokens.aufrufe} Aufrufe · ${e.dauerSek}s${cache ? ' (Cache)' : ''}`);
  }
  const dir = join(AUSGABE, 'messung', lauf);
  await mkdir(dir, { recursive: true });
  await Bun.write(join(dir, 'ergebnis.json'), JSON.stringify({ lauf, modell: MODELL, profil: profilText, ergebnisse }, null, 2));
  await Bun.write(join(dir, 'bericht.md'), berichtMarkdown(lauf, profilText, ergebnisse));
  console.log(`\nBericht: ${join(dir, 'bericht.md')}`);
  process.exit(0);
}
