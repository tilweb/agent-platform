/**
 * /prozess-start — Einbau-Tabelle (Kern-Deliverable, SKILL_prozess-start.md Z. 24-34).
 *
 * Acht Spalten je Prozess (Sprechzettel für den Menschen am Panel):
 *   1 Nr + Ist-Name · 2 Namens-Vorschlag (NK §A2) · 3 Typ MP|TP|SP (+ 1-Satz-Begründung)
 *   4 Kopfblock-Text (§A8, fertig formuliert) · 5 Beschreibungs-Einzeiler
 *   6 C_ProzessTyp (CFG-Wert) · 7 bei SP: Frische-Kontrakt (§A9) · 8 Umbenenn-Risiko
 *
 * Baut auf den Steckbriefen auf (Typ/Soll/Beschreibung/Call-Graph). Was der Export
 * nicht hergibt, bleibt ❓ (Owner/Takt/Frische-Schwelle = Eingabe; Umbenenn-Wirkung =
 * Panel-Frage, Graph≠Text — nie statisch verneinen). Rein & deterministisch.
 */
import { baueSteckbriefe, type Steckbrief, type SteckbriefEingang } from './steckbriefe';
import type { NkNamensmodul, VarFundort } from './nk';

export interface FrischeKontrakt {
  benoetigt: boolean;              // nur bei SP
  hatLetzterLauf: boolean;         // T_…Zeit (letzter erfolgreicher Lauf, Datum+Uhrzeit)
  hatStandDatum: boolean;          // T_…Datum (Stand des Ergebnisses)
  schwelleVorschlag: string;       // ❓ C_FrischeTage — Fachbereichs-Entscheid, nie selbst festlegen
  verstoss: boolean;               // SP ohne beide Frische-Variablen (§A10-Prüfpaar)
}

export interface EinbauZeile {
  nr: string;
  istName: string;
  namensVorschlag: string;
  namensVorschlagQuelle: string;   // entschieden | twin | vorschlag | offen
  typ: Steckbrief['typ'];
  typBegruendung: string;
  kopfblock: string;               // §A8-Template, fertig formuliert
  beschreibung: string;
  cProzessTyp: string;             // MP/TP/SP oder ❓
  frische?: FrischeKontrakt;
  umbenennAufrufer: string[];      // wer referenziert den Prozess (aus dem Call-Graph)
  umbenennFrage: string;           // [Panel]-❓
}

const TYP_BEGRUENDUNG: Record<string, string> = {
  MP: 'Ruft andere auf und wird selbst von keinem gerufen → Master.',
  TP: 'Wird gerufen und trägt Fachlogik → Teilprozess.',
  SP: 'Wird gerufen und stellt nur etwas bereit (keine Fachlogik) → Stützprozess.',
  UNENTSCHIEDEN: 'Wird gerufen — Teilprozess (Fachlogik) oder Stützprozess (Stütze)? Fachlich entscheiden ❓.',
};

/** §A8-Kopfblock: Name · vX.Y · Zweck · Owner · Takt · Typ · NK-Regime. */
function kopfblock(name: string, typWert: string, beschreibung?: string): string {
  return `${name} · v1.0 · Zweck: ${beschreibung?.replace(/·.*$/, '').trim() || '❓'} · Owner: ❓ · Takt: ❓ · Typ: ${typWert} · NK: v2 ab Bau`;
}

/** Baut die Einbau-Tabelle aus Namensmodul + Extraktions-Fundorten (Call-Graph aus aufrufe). */
export function einbauTabelle(input: {
  namensraum?: string;
  familie?: string;
  namensmodul: NkNamensmodul;
  fundorte: VarFundort[];
  callGraph: { von: string; nach: string }[];
  prozesseMeta?: Record<string, SteckbriefEingang>;
}): EinbauZeile[] {
  // Steckbriefe liefern Typ (MP maschinell), Soll-Kaskade, Beschreibung, Call-Graph.
  const meta = input.prozesseMeta ?? Object.fromEntries(Object.entries(input.namensmodul.prozesse ?? {}).map(([nr, p]) => [nr, {
    ist: p.ist, typGesetzt: p.typ, istConfig: /config|cfg/i.test(p.ist) || /_UTIL$/.test(p.soll ?? ''), sollEntschieden: p.soll,
  } as SteckbriefEingang]));
  const steckbriefe = baueSteckbriefe({
    namensraum: input.namensraum ?? input.namensmodul.namensraum,
    familie: input.familie ?? input.namensmodul.familie,
    prozesse: meta, callGraph: input.callGraph,
  });

  // Neu-Namen (Rolle T) je Prozess für den Frische-Kontrakt.
  const tVarsJeProzess = new Map<string, string[]>();
  const altToNeu = new Map(input.namensmodul.map.map((e) => [e.alt, e]));
  for (const f of input.fundorte) {
    const e = altToNeu.get(f.name);
    if (e?.rolle === 'T') {
      if (!tVarsJeProzess.has(f.p)) tVarsJeProzess.set(f.p, []);
      if (!tVarsJeProzess.get(f.p)!.includes(e.neu)) tVarsJeProzess.get(f.p)!.push(e.neu);
    }
  }

  return steckbriefe.map((b) => {
    const cProzessTyp = b.typ === 'UNENTSCHIEDEN' ? '❓' : b.typ;
    const name = b.soll || b.ist;

    let frische: FrischeKontrakt | undefined;
    if (b.typ === 'SP') {
      const tVars = tVarsJeProzess.get(b.nr) ?? [];
      const hatStandDatum = tVars.some((n) => /Datum$/.test(n));
      const hatLetzterLauf = tVars.some((n) => /Zeit$/.test(n));
      frische = {
        benoetigt: true, hatLetzterLauf, hatStandDatum,
        schwelleVorschlag: '❓ C_FrischeTage — mit Fachbereich vereinbaren (kein Hauswert)',
        verstoss: !(hatStandDatum && hatLetzterLauf),
      };
    }

    return {
      nr: b.nr,
      istName: b.ist,
      namensVorschlag: b.soll ?? '',
      namensVorschlagQuelle: b.sollQuelle,
      typ: b.typ,
      typBegruendung: TYP_BEGRUENDUNG[b.typ] ?? '',
      kopfblock: kopfblock(name, cProzessTyp, b.beschreibung),
      beschreibung: b.beschreibung ?? '',
      cProzessTyp,
      frische,
      umbenennAufrufer: b.aufrufer,
      umbenennFrage: b.aufrufer.length
        ? `Bricht Umbenennen die Verweise von ${b.aufrufer.join(', ')}? Am Panel/Testlauf prüfen — Tippen-Felder {CV:…} ziehen NICHT nach (Graph≠Text). [Panel] ❓`
        : 'Keine Aufrufer im Satz — Umbenenn-Wirkung dennoch am Panel prüfen (Graph≠Text). [Panel] ❓',
    };
  });
}
