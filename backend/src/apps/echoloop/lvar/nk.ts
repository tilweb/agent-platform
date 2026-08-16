/**
 * NK-Gate G1–G7 — Namenskonvention-Prüfung (STANDARD_Namenskonvention v2.2).
 *
 * Prüft die Ziel-Namen eines Namensmoduls (alt → neu, Rolle) einer Prozess-
 * Familie gegen die sieben Gates:
 *   G1 Präfix-Kanon   — Rolle-Präfix aus geschlossenem Kanon (C_/H_/T_) oder Fachwert (U, kein Präfix)
 *   G2 Grammatik      — PascalCase, kein Unterstrich außer im Präfix, keine Negation im Namen
 *   G3 Synonym-Cluster — zwei Zielnamen meinen dasselbe (nur fachlich lösbar → am Panel)
 *   G4 Mehrfachzuordnung — ein Zielname von mehreren Alt-Namen beansprucht: Dublette (selber
 *                          Prozess, Defekt) vs. Konsolidierung (verschiedene Prozesse, gewollt)
 *   G5 Entscheidungsquote — Anteil Namen, die nur der umformatierte Panel-Name sind
 *   G6 Kategorie-Wörter — das Wort am Ende stammt aus der geschlossenen Liste (§A3b ②)
 *   G7 Modul-Format   — genau vier Rollen C · H · T · U (U = Fachwert ohne Präfix)
 *
 * Soft-Default (Prinzip §3.2): hart nur bei Kanon-Verstoß + selbstvergebenem Namen;
 * alles andere ist sichtbar, nicht sperrend. Rein & deterministisch (kein LLM).
 *
 * Gegen den Übungsfall kalibriert (__fixtures__/uebungsfall/nk-namensmodul.json):
 * 24 Zielnamen → 21 entschieden · G1–G3/G5–G7 erfüllt · G4 offen (eine Dublette).
 */

export type NkRolle = 'C' | 'H' | 'T' | 'U';

export interface NkEintrag { alt: string; neu: string; rolle: NkRolle; }

export interface NkNamensmodul {
  kd?: string;
  familie?: string;
  namensraum?: string;
  map: NkEintrag[];
  prozesse?: Record<string, { ist: string; typ?: 'MP' | 'TP' | 'SP'; soll?: string }>;
}

/** Fundort einer Variable (aus der Extraktion): welcher Alt-Name in welchem Prozess. */
export interface VarFundort { name: string; p: string; }

/** §A3 ③: die vier Rollen-Kürzel (U = Fachwert ohne Präfix). */
export const ROLLE_PREFIX: Record<NkRolle, string> = { C: 'C_', H: 'H_', T: 'T_', U: '' };
export const ROLLE_KANON: NkRolle[] = ['C', 'H', 'T', 'U'];

/**
 * §A3b ②: geschlossene Liste der Kategorie-Wörter (Referenz nk_messung.py).
 * Kern · Erweitert · Einheiten (inkl. `Liste`).
 */
export const KATEGORIE_WOERTER = [
  'Pfad', 'Datei', 'Datum', 'Text', 'Zahl',                         // Kern
  'Name', 'Nummer', 'Status', 'Anzahl', 'Grund', 'Dateiname',       // Erweitert
  'Sek', 'Ms', 'Tage', 'Eur', 'Prozent', 'Zeit', 'Liste',          // Einheiten
];

/**
 * Verworfene Kategorie-Wörter → Ersatz (§A3b, nk_messung.py `VERWORFEN`).
 * G6 prüft als BLACKLIST: der Referenz-Prüfer erzwingt NICHT positiv, dass das
 * Endwort aus KATEGORIE stammt, sondern meldet nur verworfene Wörter.
 */
export const VERWORFEN: Record<string, string> = {
  Nr: 'Nummer', Ordner: 'Pfad', Verzeichnis: 'Pfad', Dokument: 'Datei',
};

/** §A3b ③: verbotene Negationswörter im Namen (Referenz nk_messung.py: Nicht/Kein/Ohne). */
export const NEGATION_WOERTER = ['Nicht', 'Kein', 'Ohne'];

/** §A3 ③: Pflicht-Eigenname je Prozess, von G1 ausgenommen (nie ein Präfix-Verstoß). */
const A_ERGEBNIS = 'A_Ergebnis';

export interface NkGate { titel: string; erfuellt: boolean; details: string[]; }

export interface NkG4Eintrag {
  neu: string;
  art: 'dublette' | 'konsolidierung';
  prozesse: string[];
  alt: string[];
}

export interface NkErgebnis {
  zielnamen: number;                 // Anzahl MAP-Einträge (Alt-Namen)
  entschieden: number;               // eindeutige Zielnamen (nach Konsolidierung)
  entscheidungsquote: { fertig: number; umformatiert: number; entschieden: number; quoteUmformatiert: number };
  gates: Record<'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7', NkGate>;
  g4: Record<string, NkG4Eintrag>;
  synonymCluster: Record<string, string[]>;
  offen: string[];                   // Gate-IDs, die nicht erfüllt sind
  gold: boolean;                     // alle Gates erfüllt
  nurUmformatiert: string[];         // G5-Befunde
  hartVerstoss: string[];            // sperrende G1-Verstöße (Kanon), Soft-Default §3.2
  sperrend: boolean;                 // true wenn ein harter G1-Verstoß vorliegt (Bau-Abbruch)
}

/** Normalisiert einen Namen für Wortvergleiche (klein, ohne Nicht-Buchstaben, Umlaute → Basisform). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}

/** Kern eines Zielnamens ohne Rollen-Präfix. */
function ohnePraefix(neu: string): string {
  return neu.replace(/^[CHT]_/, '');
}

/**
 * Prüft ein Namensmodul gegen G1–G7. `fundorte` = extrahierte Variablen
 * (Name + Prozess), nötig für die Dublette-vs-Konsolidierung-Unterscheidung (G4).
 */
export function pruefeNK(modul: NkNamensmodul, fundorte: VarFundort[] = []): NkErgebnis {
  const map = modul.map;
  const zielnamen = map.length;

  // Alt-Name → Prozesse (aus der Extraktion).
  const altProzesse = new Map<string, Set<string>>();
  for (const f of fundorte) {
    if (!altProzesse.has(f.name)) altProzesse.set(f.name, new Set());
    altProzesse.get(f.name)!.add(f.p);
  }

  // Ziel-Name → beanspruchende Alt-Namen (Selbst-Umbenennung alt===neu zählt NICHT).
  const zielAlt = new Map<string, NkEintrag[]>();
  for (const e of map) {
    if (!zielAlt.has(e.neu)) zielAlt.set(e.neu, []);
    zielAlt.get(e.neu)!.push(e);
  }
  const eindeutig = [...zielAlt.keys()];
  const entschiedenAnzahl = eindeutig.length;

  // ── G1 Präfix-Kanon (A_Ergebnis whitelisten; hart nur bei 3 Kanon-Codes) ────
  const g1Verstoss: string[] = [];
  const g1Hart: string[] = [];
  for (const neu of eindeutig) {
    if (neu === A_ERGEBNIS) continue;                          // Pflicht-Eigenname, immer sauber
    const e = zielAlt.get(neu)![0]!;                           // beabsichtigte Rolle
    const hatPraefix = /^[A-ZÄÖÜ]_/.test(neu);                 // beliebiges Ein-Buchstaben-Präfix
    const praefix = hatPraefix ? neu.slice(0, 2) : '';
    if (e.rolle === 'U' && hatPraefix) {
      const m = `${neu}: Fachwert (U) darf kein Präfix tragen [G1-PRAEFIX-BEI-FACHWERT]`;
      g1Verstoss.push(m); g1Hart.push(m);
    } else if (e.rolle !== 'U' && !hatPraefix) {
      g1Verstoss.push(`${neu}: Rolle ${e.rolle} verlangt Präfix ${ROLLE_PREFIX[e.rolle]} [G1-PRAEFIX-FEHLT, weich]`);
    } else if (e.rolle !== 'U' && praefix !== ROLLE_PREFIX[e.rolle]) {
      const m = `${neu}: Präfix ${praefix} passt nicht zu Rolle ${e.rolle} [G1-PRAEFIX-ROLLE-BRUCH]`;
      g1Verstoss.push(m); g1Hart.push(m);
    }
  }

  // ── G2 Grammatik (PascalCase · kein Extra-Unterstrich · keine Negation) ─────
  const g2Verstoss: string[] = [];
  for (const neu of eindeutig) {
    const kern = ohnePraefix(neu);
    if (/_/.test(kern)) g2Verstoss.push(`${neu}: Unterstrich außerhalb des Präfixes`);
    if (kern && !/^[A-ZÄÖÜ]/.test(kern)) g2Verstoss.push(`${neu}: kein PascalCase (Großbuchstabe am Anfang)`);
    for (const n of NEGATION_WOERTER) {
      if (new RegExp(`(^|[A-ZÄÖÜ])${n}([A-ZÄÖÜ]|$)`).test(kern)) g2Verstoss.push(`${neu}: Negation „${n}" — positiv formulieren (Ist/Hat/Darf)`);
    }
  }

  // ── G3 Synonym-Cluster (nur fachlich/am Panel entscheidbar → nicht auto-flaggen) ─
  const synonymCluster: Record<string, string[]> = {};

  // ── G4 Mehrfachzuordnung (Dublette vs. Konsolidierung) ──────────────────────
  const g4: Record<string, NkG4Eintrag> = {};
  for (const [neu, eintraege] of zielAlt) {
    const beansprucht = eintraege.filter((e) => e.alt !== neu); // Selbst-Umbenennung raus
    if (beansprucht.length < 2) continue;
    const prozesseSet = new Set<string>();
    for (const e of beansprucht) for (const p of altProzesse.get(e.alt) ?? []) prozesseSet.add(p);
    const alleGleicherProzess = prozesseSet.size <= 1;
    g4[neu] = {
      neu,
      art: alleGleicherProzess ? 'dublette' : 'konsolidierung',
      prozesse: alleGleicherProzess ? [...prozesseSet] : [],
      alt: beansprucht.map((e) => e.alt),
    };
  }
  const hatDublette = Object.values(g4).some((x) => x.art === 'dublette');

  // ── G5 Entscheidungsquote (fertig · nur umformatiert · entschieden) ─────────
  let fertig = 0;
  const nurUmformatiert: string[] = [];
  for (const e of map) {
    if (e.alt === e.neu) { fertig++; continue; }              // schon umbenannt
    if (norm(e.alt) === norm(ohnePraefix(e.neu))) nurUmformatiert.push(`${e.alt} → ${e.neu}`);
  }
  const umformatiert = nurUmformatiert.length;
  const entschieden = zielnamen - fertig - umformatiert;
  const quoteUmformatiert = zielnamen ? Math.round((umformatiert / zielnamen) * 1000) / 10 : 0;

  // ── G6 Kategorie-Wörter (Blacklist: verworfene Wörter, nicht Whitelist) ─────
  const g6Verstoss: string[] = [];
  for (const neu of eindeutig) {
    const kern = ohnePraefix(neu);
    const woerter = kern.match(/[A-ZÄÖÜ][a-zäöüß0-9]*/g) ?? [];
    for (const w of woerter) if (VERWORFEN[w]) g6Verstoss.push(`${neu}: „${w}" ist verworfen → „${VERWORFEN[w]}" [G6-WORT-VERWORFEN]`);
  }

  // ── G7 Modul-Format (genau die vier Rollen C·H·T·U) ─────────────────────────
  const rollenBenutzt = new Set(map.map((e) => e.rolle));
  const g7Fremd = [...rollenBenutzt].filter((r) => !ROLLE_KANON.includes(r));

  const gates: NkErgebnis['gates'] = {
    G1: { titel: 'Präfix-Kanon', erfuellt: g1Verstoss.length === 0, details: g1Verstoss },
    G2: { titel: 'Grammatik', erfuellt: g2Verstoss.length === 0, details: g2Verstoss },
    G3: { titel: 'Synonym-Cluster', erfuellt: Object.keys(synonymCluster).length === 0, details: [] },
    G4: { titel: 'Mehrfachzuordnung', erfuellt: !hatDublette, details: Object.values(g4).map((x) => `${x.neu}: ${x.art} (${x.alt.join(', ')})`) },
    G5: { titel: 'Entscheidungsquote', erfuellt: quoteUmformatiert <= 5.0, details: nurUmformatiert },
    G6: { titel: 'Kategorie-Wörter', erfuellt: g6Verstoss.length === 0, details: g6Verstoss },
    G7: { titel: 'Modul-Format', erfuellt: g7Fremd.length === 0, details: g7Fremd.map((r) => `Fremde Rolle: ${r}`) },
  };
  const offen = (Object.keys(gates) as (keyof typeof gates)[]).filter((k) => !gates[k].erfuellt);

  return {
    zielnamen,
    entschieden: entschiedenAnzahl,
    entscheidungsquote: { fertig, umformatiert, entschieden, quoteUmformatiert },
    gates,
    g4,
    synonymCluster,
    offen,
    gold: offen.length === 0,
    nurUmformatiert,
    hartVerstoss: g1Hart,
    sperrend: g1Hart.length > 0,
  };
}
