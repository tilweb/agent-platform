/**
 * Prüfmuster PM-01…PM-10 — Reimplementierung aus
 * docs/Echo-Loop-App/02_Standards/PRUEFMUSTER-KATALOG.md.
 *
 * Prinzip: maschinell entscheidbare Muster liefern harte Befunde; wo der
 * Katalog "statisch nicht entscheidbar → Panel/Graph" sagt (PM-04b, PM-10,
 * ref-ohne-Export), wird ein ❓-Befund (schwere 'frage') ausgegeben, KEIN
 * Hard-Fail. Jeder Befund traegt Beleg + Provenienz + RGA-Dimension.
 */
import type { EmmaFamily, EmmaProcess, PMFinding } from './types';

/** PM-13 · Feste Wartezeiten (Bautechnik D2): Warten im Zeit-Modus statt Signal-Warten. */
export function pm13(fam: EmmaFamily): PMFinding[] {
  const out: PMFinding[] = [];
  for (const p of fam.processes) {
    // Blindes UI-Warten = ≥ 0,5 s und kein Manipulations-/Sammel-Knoten (WB50).
    const blind = p.fixedWaits.filter((w) => !w.istManipulation && w.sekunden >= 0.5);
    if (!blind.length) continue;
    const dauern = [...new Set(blind.map((w) => w.sekunden))].sort((a, b) => a - b);
    const manip = p.fixedWaits.length - blind.length;
    out.push({
      pm: 'PM-13', aspekt: 'Feste Wartezeiten', prozessNr: p.nr,
      befund: `${blind.length} feste Wartezeit(en) im Zeit-Modus${dauern.length ? ` (${dauern.join(' · ')} s)` : ''} statt signalbasiertem Warten — funktioniert am Bau-Tag, bricht unter Last (klassische Erstbau-Signatur).${manip ? ` ${manip} weitere Warten sind kurz (< 0,5 s) oder Manipulations-/Sammel-Knoten (WB50) — nicht kritisch.` : ''}`,
      beleg: `Schritte ${blind.map((w) => `S${w.schrittId}`).join(', ')} · Subject:Time`,
      provenienz: '[G Text]', schwere: 'mittel',
      empfehlung: 'Jede feste Wartezeit durch „Warten auf Element/Anker" ersetzen (Finden mit Zeitlimit); bestehende Waits NICHT verlängern.',
      dimensionen: ['D2'],
    });
  }
  return out;
}

/** PM-14 · Feste Klick-Positionen (Bautechnik D1): Klicken auf absolute Koordinaten statt Anker. */
export function pm14(fam: EmmaFamily): PMFinding[] {
  const out: PMFinding[] = [];
  for (const p of fam.processes) {
    if (!p.fixedClicks.length) continue;
    const absolut = p.fixedClicks.filter((c) => !c.vermutlichFundgebunden);
    const fund = p.fixedClicks.filter((c) => c.vermutlichFundgebunden);
    if (absolut.length) {
      out.push({
        pm: 'PM-14', aspekt: 'Feste Klick-Position', prozessNr: p.nr,
        befund: `${absolut.length} Klick(s) auf feste Bildschirm-Koordinaten (${absolut.slice(0, 6).map((c) => `S${c.schrittId} ${c.x}/${c.y}`).join(', ')}${absolut.length > 6 ? ' …' : ''}) — brechen bei Scroll-/Fensteränderung.`,
        beleg: `Klicken mit absolutem X/Y, kein Anker`,
        provenienz: '[G Text]', schwere: 'mittel',
        empfehlung: 'An den Fund/Anker binden (Finden & Klicken) statt feste Koordinate; Suchbereich eingrenzen.',
        dimensionen: ['D1'],
      });
    }
    if (fund.length) {
      out.push({
        pm: 'PM-14', aspekt: 'Klick am Fundort', prozessNr: p.nr,
        befund: `${fund.length} Klick(s) mit X:0/Y:0 (${fund.slice(0, 6).map((c) => `S${c.schrittId}`).join(', ')}) — deutet auf Fund-Bindung (Klick am Fundort) hin; aus der PDF-Statik nicht sicher entscheidbar.`,
        beleg: `Klicken X:0/Y:0`,
        provenienz: '[Panel]', schwere: 'frage',
        empfehlung: 'Am Eigenschaften-Panel bestätigen: an den Fund gebunden (korrekt) oder feste Position?',
        dimensionen: ['D1'],
      });
    }
  }
  return out;
}

/** PM-01 · Endlosschleifen-Risiko: ResetBeforeStart:True ohne gebundenen Zähler. */
export function pm01(fam: EmmaFamily): PMFinding[] {
  const out: PMFinding[] = [];
  for (const p of fam.processes) {
    for (const l of p.loops) {
      if (l.resetBeforeStart !== true) continue;
      const endless = !l.zaehlerVariabel;
      out.push({
        pm: 'PM-01',
        aspekt: 'Endlosschleifen-Risiko',
        prozessNr: p.nr,
        schrittId: l.schrittId,
        befund: endless
          ? `Schleife S${l.schrittId} mit ResetBeforeStart:True und ohne variablengebundenen Zähler (MaxLoopCount:${l.maxLoopCount}) — Zähler wird vor jedem Start auf 0 gesetzt, Abbruchbedingung wird ggf. nie erreicht (Endlos-/Ressourcen-Risiko).`
          : `Schleife S${l.schrittId} mit ResetBeforeStart:True — Zähler wirkt variablengebunden; Reset-Vollständigkeit am Panel prüfen.`,
        beleg: `ResetBeforeStart:True${l.maxLoopCount ? ` · MaxLoopCount:${l.maxLoopCount}` : ''}`,
        provenienz: '[G Text]',
        schwere: endless ? 'kritisch' : 'mittel',
        empfehlung: 'ResetBeforeStart:False setzen ODER eine akkumulierende Zähler-Variable binden; MaxLoopCount an die Datenmenge koppeln.',
        dimensionen: ['D2', 'D4'],
      });
    }
  }
  return out;
}

/** PM-02 · Waisen-Prozess: gebaut, aber nirgends aufgerufen (Master ist legitim uncalled). */
export function pm02(fam: EmmaFamily): PMFinding[] {
  const out: PMFinding[] = [];
  const present = new Set(fam.processes.map((p) => p.nr));
  const called = new Set<string>();
  for (const p of fam.processes) for (const c of p.calls) if (c.testCaseId > 0) called.add(String(c.testCaseId));

  // uncalled Prozesse
  for (const p of fam.processes) {
    if (called.has(p.nr)) continue;
    const ruftAndere = p.calls.some((c) => c.testCaseId > 0);
    if (ruftAndere) {
      out.push({
        pm: 'PM-02', aspekt: 'Master/Einstieg', prozessNr: p.nr,
        befund: `Prozess ${p.nr} wird von keinem anderen aufgerufen, ruft aber selbst Unterprozesse — legitimer Master/Einstieg.`,
        beleg: `uncalled; ruft ${p.calls.filter((c) => c.testCaseId > 0).length} Unterprozesse`,
        provenienz: '[Graph]', schwere: 'niedrig',
        empfehlung: 'Kein Handlungsbedarf (Einstiegspunkt).', dimensionen: ['D9'],
      });
    } else {
      out.push({
        pm: 'PM-02', aspekt: 'Waisen-Prozess', prozessNr: p.nr,
        befund: `Prozess ${p.nr} wird von keinem TestCaseID aufgerufen und ruft selbst niemanden — Waise (Funktion läuft nie).`,
        beleg: 'uncalled + ruft niemanden',
        provenienz: '[Graph]', schwere: 'kritisch', seedOrBug: 'bug',
        empfehlung: 'Aufruf verdrahten (fehlenden TestCaseID setzen) ODER toten Prozess löschen.', dimensionen: ['D9'],
      });
    }
  }
  // referenziert, aber nicht exportiert (kann legitimer geteilter Unterprozess sein)
  for (const nr of called) {
    if (!present.has(nr)) {
      out.push({
        pm: 'PM-02', aspekt: 'Referenz ohne Export', prozessNr: nr,
        befund: `Prozess ${nr} wird aufgerufen, liegt aber nicht im hochgeladenen Export-Set — nicht prüfbar (geteilter Unterprozess?).`,
        beleg: 'in TestCaseID referenziert, kein Prozess_' + nr + ' hochgeladen',
        provenienz: '[Graph]', schwere: 'frage',
        empfehlung: 'Fehlenden Prozess-Export nachliefern oder bestätigen, dass er außerhalb des Scopes liegt.', dimensionen: ['D9'],
      });
    }
  }
  return out;
}

/** PM-03 · Toter Aufruf: TestCaseID:-1/0 = kein Ziel zugewiesen (No-op). */
export function pm03(fam: EmmaFamily): PMFinding[] {
  const out: PMFinding[] = [];
  for (const p of fam.processes) {
    for (const c of p.calls) {
      if (c.testCaseId > 0) continue;
      out.push({
        pm: 'PM-03', aspekt: 'Toter Aufruf', prozessNr: p.nr, schrittId: c.schrittId,
        befund: `Verschachtelter Prozess S${c.schrittId} mit TestCaseID:${c.testCaseId} — kein Ziel zugewiesen, läuft nie (reißt die Kette, ohne dass EMMA warnt).`,
        beleg: `TestCaseID:${c.testCaseId}`,
        provenienz: '[G Text]', schwere: 'kritisch', seedOrBug: 'bug',
        empfehlung: 'Echte Ziel-ID setzen (Ziel-Prozess vorher auf Existenz prüfen, sonst bauen).', dimensionen: ['D3', 'D9'],
      });
    }
  }
  return out;
}

/** PM-04 · Feste Schleifen-Grenze — NEUTRALER Prüf-Prompt (Notdeckel ODER geraten?). */
export function pm04(fam: EmmaFamily): PMFinding[] {
  const out: PMFinding[] = [];
  for (const p of fam.processes) {
    for (const l of p.loops) {
      if (!l.maxIstLiteral || l.zaehlerVariabel) continue;
      out.push({
        pm: 'PM-04', aspekt: 'Feste Schleifen-Grenze', prozessNr: p.nr, schrittId: l.schrittId,
        befund: `Schleife S${l.schrittId} mit festem MaxLoopCount:${l.maxLoopCount} (kein {CV:…}, kein Signal-Ausstieg erkennbar). Prüfen: validierter Notdeckel (≥ Domänen-Maximum) ODER geratene Menge (< mögliches Volumen → Datenverlust-Risiko)?`,
        beleg: `MaxLoopCount:${l.maxLoopCount} (Literal)`,
        provenienz: '[G Text]', schwere: 'frage',
        empfehlung: 'Mit Domänen-Volumen entscheiden: fest lassen (Notdeckel) oder auf {CV:Anzahl}/Signal-Ausstieg umbauen.', dimensionen: ['D2'],
      });
    }
  }
  return out;
}

/** PM-04b · Reset-Vollständigkeit der inneren Schleife — statisch NICHT entscheidbar → Panel-Frage. */
export function pm04b(fam: EmmaFamily): PMFinding[] {
  const out: PMFinding[] = [];
  for (const p of fam.processes) {
    if (p.loops.length >= 2) {
      out.push({
        pm: 'PM-04b', aspekt: 'Reset-Vollständigkeit innere Schleife', prozessNr: p.nr,
        befund: `Prozess ${p.nr} hat ${p.loops.length} Schleifen (mögliche Verschachtelung). Reset-Vollständigkeit über ALLE Rücksprung-Pfade der inneren Schleife ist aus dem PDF-Text nicht entscheidbar.`,
        beleg: `${p.loops.length} Schleifen-Bausteine`,
        provenienz: '[Panel]', schwere: 'frage',
        empfehlung: 'Am Graph/Panel prüfen: führt JEDER Rücksprung-Pfad in die innere Schleife vorher ein <Boot-Variable>=True?', dimensionen: ['D2', 'D3'],
      });
    }
  }
  return out;
}

/**
 * PM-09 · OCR/ABBYY-Kontingent-Budget: Aufruf-Baum-Problem, nicht nur Schleife.
 * Multiplikator je Prozess = lokaler Schleifen-Produkt × max(Multiplikator der Aufrufer).
 * ABBYY-Druck je OCR-Read = Multiplikator × Timeout × Accuracy-Faktor.
 */
export function pm09(fam: EmmaFamily): PMFinding[] {
  const out: PMFinding[] = [];
  const CV_ESTIMATE = 50; // {CV:…} ohne bekannte Menge → konservative Schätzung
  const LOOP_CAP = 1000;

  const localLoopFactor = (p: EmmaProcess): number => {
    let f = 1;
    for (const l of p.loops) {
      const n = l.maxIstLiteral && l.maxLoopCount ? Number(l.maxLoopCount) : CV_ESTIMATE;
      f *= Math.max(1, Math.min(LOOP_CAP, n || 1));
    }
    return f;
  };

  // Aufrufer je Prozess
  const callers = new Map<string, string[]>();
  for (const p of fam.processes) for (const c of p.calls) if (c.testCaseId > 0) {
    const k = String(c.testCaseId);
    callers.set(k, [...(callers.get(k) ?? []), p.nr]);
  }

  // Multiplikator via memoisierter DFS über die Aufrufer (Zyklen-Schutz)
  const memo = new Map<string, number>();
  const stack = new Set<string>();
  const multiplier = (nr: string): number => {
    if (memo.has(nr)) return memo.get(nr)!;
    if (stack.has(nr)) return 1; // Zyklus
    stack.add(nr);
    const p = fam.byNr.get(nr);
    const local = p ? localLoopFactor(p) : 1;
    const cs = callers.get(nr) ?? [];
    const parent = cs.length ? Math.max(...cs.map((c) => multiplier(c))) : 1;
    const val = Math.min(local * parent, Number.MAX_SAFE_INTEGER);
    stack.delete(nr);
    memo.set(nr, val);
    return val;
  };

  for (const p of fam.processes) {
    if (!p.ocrReads.length) continue;
    const mult = multiplier(p.nr);
    for (const o of p.ocrReads) {
      const accFactor = /accurate/i.test(o.textExtractionMode ?? '') ? 2 : 1;
      const timeoutFactor = o.timeoutMs ? o.timeoutMs / 1000 : 1;
      const druck = Math.round(mult * accFactor * timeoutFactor);
      // Schwelle: hoher Aufruf-Baum-Multiplikator ODER Accurate im tiefen Baum
      const schwere = mult >= 1000 ? 'kritisch' : mult >= 100 ? 'hoch' : accFactor === 2 ? 'mittel' : 'niedrig';
      out.push({
        pm: 'PM-09', aspekt: 'OCR/ABBYY-Kontingent', prozessNr: p.nr, schrittId: o.schrittId,
        befund: `OCR-Read S${o.schrittId} (Subject:${o.subject}${o.textExtractionMode ? `, ${o.textExtractionMode}` : ''}${o.timeoutMs ? `, ${o.timeoutMs}ms` : ''}) unter Aufruf-Baum-Multiplikator ×${mult} → ABBYY-Druck-Rang ~${druck}. OCR-Verbrauch multipliziert sich über die Schleifen ALLER Aufrufer.`,
        beleg: `Subject:${o.subject} · Multiplikator ×${mult}`,
        provenienz: '[G Text]', schwere,
        empfehlung: 'Timeout senken · Accurate→Fast · Read aus der Schleife ziehen/cachen · früher Break bei Treffer · OCR-Read möglichst weit oben statt im tiefen Unterprozess.',
        dimensionen: ['D2', 'D4'],
      });
    }
  }
  return out;
}

/**
 * PM-10 · Seed vs. gebunden (Laufzeit-Echo). Aus PDF-Statik nie „Seed" behaupten
 * — Datums-Kohorten (dasselbe Datum in mehreren Literalen/Prozessen) sind
 * starkes Indiz FÜR Bindung; isolierte Literale bleiben ❓ (Panel).
 */
export function pm10(fam: EmmaFamily): PMFinding[] {
  const out: PMFinding[] = [];
  // familienweite Datums-Kohorte
  const cohort = new Map<string, Set<string>>();
  for (const p of fam.processes) for (const d of p.dateLiterals) {
    cohort.set(d, (cohort.get(d) ?? new Set()).add(p.nr));
  }
  for (const p of fam.processes) {
    for (const d of p.dateLiterals) {
      const inProcs = cohort.get(d)!;
      const kohorte = inProcs.size >= 2;
      out.push({
        pm: 'PM-10', aspekt: 'Seed vs. gebunden', prozessNr: p.nr,
        befund: kohorte
          ? `Datums-Literal ${d} tritt in ${inProcs.size} Prozessen der Familie auf → wahrscheinlich Laufzeit-Echo EINES historischen Laufs (GEBUNDEN, nicht Seed).`
          : `Datums-Literal ${d} isoliert in Prozess ${p.nr} — Seed vs. Bindung aus der PDF-Statik nicht entscheidbar.`,
        beleg: `Literal ${d}${kohorte ? ` · Kohorte in ${[...inProcs].join(',')}` : ''}`,
        provenienz: kohorte ? '[Graph]' : '[Panel]',
        schwere: kohorte ? 'niedrig' : 'frage',
        seedOrBug: kohorte ? 'unklar' : 'unklar',
        empfehlung: kohorte
          ? 'Kein Defekt-Urteil — Bindung am Panel (Variablennutzung) bestätigen.'
          : 'Screenshot „Variablennutzung" des schreibenden Schritts anfordern.',
        dimensionen: ['D6b'],
      });
    }
  }
  return out;
}
