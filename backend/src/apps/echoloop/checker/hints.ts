/**
 * Deterministische Level-Hinweise (Bautechnik → RGA-Dimension).
 *
 * Übersetzt die Checker-Signale (Befunde + Prozess-Struktur) in einen
 * konservativen Ist-Level-VORSCHLAG je Dimension + Belegzeilen. Zweck:
 *  - Das LLM startet evidenz-gestützt statt zu raten.
 *  - Ist das LLM nicht erreichbar, sind die Vorschläge der FALLBACK-Boden
 *    (nicht mehr „alles 0").
 * Wo die Statik nichts entscheiden kann (D3/D4/D5/D7 Verzweigung/Recovery),
 * bleibt der Vorschlag niedrig + ein ❓-Beleg (Panel/Graph nötig) — ehrlich,
 * wie im Goldstandard.
 */
import type { EmmaFamily } from './types';
import type { Dim } from '../scoring';

export interface DimHint {
  /** konservativer Ist-Level-Vorschlag 0-5. */
  suggest: number;
  /** Belegzeilen (fließen in den Baustand-Beleg + LLM-Kontext). */
  evidence: string[];
}
export type DimHints = Partial<Record<Dim, DimHint>>;

export interface TopHebel {
  dim: string;
  titel: string;
  wirkung: string;
}

export interface CheckerHints {
  dims: DimHints;
  topHebel: TopHebel[];
}

export function deriveHints(fam: EmmaFamily): CheckerHints {
  // Aggregate über die Familie
  const blindWaits = fam.processes.flatMap((p) => p.fixedWaits.filter((w) => !w.istManipulation && w.sekunden >= 0.5));
  const absClicks = fam.processes.flatMap((p) => p.fixedClicks.filter((c) => !c.vermutlichFundgebunden));
  const ocrReads = fam.processes.flatMap((p) => p.ocrReads);
  const ocrAccurate = ocrReads.filter((o) => /accurate/i.test(o.textExtractionMode ?? ''));
  const hardPaths = [...new Set(fam.processes.flatMap((p) => p.hardcodedPaths))];
  const plaintextPw = fam.processes.some((p) => p.hasPlaintextPassword);
  const deadCalls = fam.processes.flatMap((p) => p.calls.filter((c) => c.testCaseId <= 0));
  const endlessLoops = fam.processes.flatMap((p) => p.loops.filter((l) => l.resetBeforeStart === true && !l.zaehlerVariabel));
  const maxSteps = Math.max(0, ...fam.processes.map((p) => p.schrittCount));
  const totalCalls = fam.processes.reduce((s, p) => s + p.calls.filter((c) => c.testCaseId > 0).length, 0);
  const seedFindings = fam.processes.flatMap((p) => p.dateLiterals);

  const dims: DimHints = {};

  // D1 Anker/Erkennung
  {
    const ev: string[] = [];
    if (absClicks.length) ev.push(`${absClicks.length} feste Klick-Position(en) neben Anker-Klicks — empfindlich bei Scroll/Fenster.`);
    if (ocrReads.length) ev.push(`${ocrReads.length} Text-Erkennungs-Such(en) — empfindlich bei Schrift-/Zoom-Änderung.`);
    dims.d1 = { suggest: absClicks.length || ocrReads.length ? 2 : 3, evidence: ev.length ? ev : ['überwiegend Anker-basiertes Finden & Klicken (❓ am Panel bestätigen).'] };
  }
  // D2 Timing
  {
    const durSet = [...new Set(blindWaits.map((w) => w.sekunden))].sort((a, b) => a - b);
    dims.d2 = blindWaits.length
      ? { suggest: 1, evidence: [`${blindWaits.length} feste Wartezeit(en) (${durSet.join(' · ')} s), kein signalbasiertes Warten — bricht unter Last.`] }
      : { suggest: 2, evidence: ['keine festen Wartezeiten erkannt (❓ Signal-Warten am Graph bestätigen).'] };
  }
  // D3 Fehler/Ausgänge (statisch begrenzt)
  {
    const ev = ['Verzweigungs-/Fehlerpfad-Struktur nur am Ablauf-Graph entscheidbar (❓).'];
    if (deadCalls.length) ev.push(`${deadCalls.length} toter Aufruf (TestCaseID:-1) reißt die Kette.`);
    dims.d3 = { suggest: 1, evidence: ev };
  }
  // D4 Selbstheilung
  {
    const ev = ['keine Selbstheilungs-/Wiederanlauf-Mechanismen aus der Statik erkennbar.'];
    if (endlessLoops.length) ev.push(`${endlessLoops.length} Endlos-Risiko-Schleife (PM-01) — kein sauberer Abbruch.`);
    dims.d4 = { suggest: 0, evidence: ev };
  }
  // D5 Idempotenz/Doppelarbeits-Schutz
  dims.d5 = { suggest: 1, evidence: ['Doppelarbeits-Schutz (Status-Marker + Einstiegs-Filter) am Ablauf-Graph zu prüfen (❓).'] };
  // D6 Konfiguration
  dims.d6 = hardPaths.length
    ? { suggest: 1, evidence: [`${hardPaths.length} hart verdrahtete(r) Pfad(e) (z. B. ${hardPaths[0]!.slice(0, 40)}…) — bei Umzug Prozess öffnen.`] }
    : { suggest: 2, evidence: ['Variablen genutzt; feste Namen/Links am Panel prüfen (❓).'] };
  // D6b Datenfluss
  dims.d6b = { suggest: 2, evidence: seedFindings.length ? [`${seedFindings.length} Datums-Literal(e) — Seed vs. Bindung am Panel (PM-10).`] : ['Datenfluss-Übergaben am Panel prüfen (❓).'] };
  // D7 Messung
  dims.d7 = { suggest: 1, evidence: ['Lauf-Protokoll/Status je Vorgang aus der Statik nicht belegt (❓).'] };
  // D8 Sicherheit
  dims.d8 = plaintextPw
    ? { suggest: 0, evidence: ['Klartext-Kennwort-Literal gefunden — in den Tresor verlagern.'] }
    : { suggest: 2, evidence: ['kein Klartext-Kennwort in den Exporten ✅; Sitzungs-/Session-Login am Panel bestätigen (❓).'] };
  // D9 Modularität
  {
    const monolith = maxSteps >= 80 && totalCalls < 3;
    dims.d9 = { suggest: monolith ? 1 : 2, evidence: [monolith ? `großer Block (bis ${maxSteps} Schritte), wenig Zerlegung in Unter-Bausteine.` : `Grund-Teilung in ${fam.processes.length} Prozess(e) vorhanden.`] };
  }
  // D10 Portabilität
  dims.d10 = { suggest: 0, evidence: [(hardPaths.length || absClicks.length) ? 'feste Pfade/Positionen → umgebungsgebunden; Ziel meist „Ist halten" (maskieren, wenn keine Übertragung geplant).' : 'Übertragung aktuell nicht vorgesehen — Ziel maskieren.'] };

  // Top-Hebel deterministisch aus den stärksten Signalen (Sicherheit > Timing > Anker > Konfig > OCR)
  const topHebel: TopHebel[] = [];
  if (plaintextPw) topHebel.push({ dim: 'D8', titel: 'Kennwort in den Tresor', wirkung: 'schließt ein Klartext-Sicherheitsrisiko.' });
  if (blindWaits.length) topHebel.push({ dim: 'D2', titel: 'Feste Wartezeiten durch signalbasiertes Warten ersetzen', wirkung: `macht ${blindWaits.length} Stellen unempfindlich gegen langsame Tage — der Kern der Stabilisierung.` });
  if (absClicks.length) topHebel.push({ dim: 'D1', titel: 'Feste Klick-Positionen an Anker binden', wirkung: `${absClicks.length} Klicks überstehen dann Scroll-/Fensteränderungen.` });
  if (ocrAccurate.length) topHebel.push({ dim: 'D1', titel: 'OCR „genau"→„schnell" + Timeouts senken', wirkung: `${ocrAccurate.length} Text-Erkennungen sparen Kontingent ohne Funktionsverlust.` });
  if (hardPaths.length) topHebel.push({ dim: 'D6', titel: 'Einstellungs-Datei statt harter Pfade/Namen', wirkung: 'Änderungen ohne Prozess-Öffnung.' });

  return { dims, topHebel: topHebel.slice(0, 4) };
}
