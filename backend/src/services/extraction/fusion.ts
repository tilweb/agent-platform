/** OCR localization and missing-value findings.
 * A full textual occurrence is `located`, not proof of label or column ownership.
 * Localization never raises confidence. Reused or absent numeric row anchors
 * produce review findings; identical extracted rows are never removed here.
 */

import { correctNumber } from '../../extraction/value-parsers';
import type { ExtractionProfile, FieldDefinition, ArrayGroupDefinition } from '../../extraction/types';
import { isArrayGroup } from '../../extraction/types';
import type { FieldBox } from './types';
import { isTesseractAvailable, ocrWordBoxes, locateValue, type OcrWord, type OcrPage } from './ocr';

export type FusionVerdict = 'located' | 'not_found_numeric' | 'not_found_text' | 'not_checkable';

export interface FusionFinding {
  /** Flacher Feld-Pfad, z.B. "felder.referenznummer" oder "positionen[3].menge_geliefert". */
  path: string;
  message: string;
}

export interface FusionOutcome {
  boxes: Record<string, FieldBox>;
  verdicts: Record<string, FusionVerdict>;
  /** Pfade, deren Konfidenz deterministisch feststeht — kein LLM-Konfidenz-Call mehr noetig. */
  decidedPaths: Set<string>;
  findings: FusionFinding[];
  /** true, wenn OCR gelaufen ist (tesseract da, Seiten vorhanden). */
  ocrRan: boolean;
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9äöüß]/g, '');

/** Zahlenartig = Zahl-Feld oder ueberwiegend Ziffern (Nummern, Referenzen, Daten). */
export function isNumericLike(value: unknown, type: FieldDefinition['type']): boolean {
  if (type === 'number' || type === 'date') return true;
  const n = norm(String(value));
  if (n.length < 3) return false;
  const digits = (n.match(/[0-9]/g) ?? []).length;
  return digits / n.length >= 0.5;
}

function emptyOutcome(ocrRan: boolean): FusionOutcome {
  return { boxes: {}, verdicts: {}, decidedPaths: new Set(), findings: [], ocrRan };
}

interface PageWords { page: OcrPage; words: OcrWord[] }

/** Deutsches Zahlformat parsen ("5,00", "1.234,56", "250") — sonst NaN. */

/**
 * Wortsuche innerhalb einer vertikalen Bande (keine Bestätigung der Spaltenrolle). Zahl-Zellen werden NUMERISCH
 * verglichen — auf dem Papier steht "5,00", das Modell liefert korrekt 5;
 * ein String-Vergleich wuerde jeden Mengenwert als unbelegt melden.
 */
function findInBand(value: unknown, isNumber: boolean, words: OcrWord[], imgH: number, bandTop: number, bandBottom: number): OcrWord | null {
  const target = norm(String(value));
  if (!target) return null;
  const numTarget = isNumber ? Number(value) : NaN;
  for (const wd of words) {
    const yMid = (wd.top + wd.height / 2) / imgH;
    if (yMid < bandTop || yMid > bandBottom) continue;
    if (isNumber && Number.isFinite(numTarget)) {
      const parsed = correctNumber(wd.text);
      if (parsed !== null && Math.abs(parsed - numTarget) < 1e-9) return wd;
      continue;
    }
    const nw = norm(wd.text);
    if (nw === target) return wd;


  }
  return null;
}

export async function fuseWithOcr(
  pages: OcrPage[],
  extracted: Record<string, unknown>,
  profile: ExtractionProfile,
  opts: { wordsByPage?: OcrWord[][] } = {},
): Promise<FusionOutcome> {
  if (pages.length === 0) return emptyOutcome(false);
  if (!opts.wordsByPage && !isTesseractAvailable()) return emptyOutcome(false);

  // OCR je Seite async (W9.2) mit begrenzter Parallelitaet: OMP_THREAD_LIMIT=1
  // haelt jeden Prozess einkernig — 2 gleichzeitig ist der vernuenftige Deckel,
  // sonst spawnt ein 12-Seiter 12 Tesseracts auf einmal.
  let allWords: OcrWord[][];
  if (opts.wordsByPage) {
    allWords = pages.map((_, i) => opts.wordsByPage![i] ?? []);
  } else {
    allWords = new Array(pages.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(2, pages.length) }, async () => {
      while (next < pages.length) {
        const idx = next++;
        allWords[idx] = await ocrWordBoxes(pages[idx]!.pngBuffer);
      }
    }));
  }
  const wordsByPage: PageWords[] = pages.map((p, i) => ({ page: p, words: allWords[i] ?? [] }));
  if (wordsByPage.every((w) => w.words.length === 0)) return emptyOutcome(false);

  const outcome = emptyOutcome(true);

  for (const [groupName, group] of Object.entries(profile.fields)) {
    if (isArrayGroup(group)) {
      fuseArrayGroup(groupName, group as ArrayGroupDefinition, extracted, wordsByPage, outcome);
      continue;
    }
    const groupData = (extracted[groupName] ?? {}) as Record<string, unknown>;
    for (const [fieldId, field] of Object.entries(group as Record<string, FieldDefinition>)) {
      const path = `${groupName}.${fieldId}`;
      const value = groupData[fieldId];
      if (value === null || value === undefined || value === '' || field.type === 'boolean') {
        outcome.verdicts[path] = 'not_checkable';
        continue;
      }
      if (field.type === 'number' && Number(value) === 0) {
        outcome.verdicts[path] = 'not_checkable';  // Null wird selten gedruckt
        continue;
      }
      let located: { pageNumber: number; box: NonNullable<ReturnType<typeof locateValue>> } | null = null;
      for (const { page, words } of wordsByPage) {
        const box = locateValue(value, field.type, words, page.width, page.height);
        if (box) { located = { pageNumber: page.pageNumber, box }; break; }
      }
      if (located) {
        outcome.boxes[path] = { page: located.pageNumber, ...located.box };
        outcome.verdicts[path] = 'located';
        outcome.decidedPaths.add(path);
      } else if (isNumericLike(value, field.type)) {
        outcome.verdicts[path] = 'not_found_numeric';
        outcome.decidedPaths.add(path);
        outcome.findings.push({
          path,
          message: `${field.label || fieldId}: Wert "${String(value)}" ist im OCR-Text des Scans nicht belegt — bitte pruefen.`,
        });
      } else {
        outcome.verdicts[path] = 'not_found_text';
      }
    }
  }

  return outcome;
}

/**
 * Listen-Zeilen: markanteste Zelle verankert die Zeilen-Bande, uebrige Zellen
 * werden nur innerhalb der Bande gesucht. Fehlende oder bereits belegte Anker erzeugen Prüfbefunde.
 */
function fuseArrayGroup(
  groupName: string,
  group: ArrayGroupDefinition,
  extracted: Record<string, unknown>,
  wordsByPage: PageWords[],
  outcome: FusionOutcome,
): void {
  const rows = extracted[groupName];
  if (!Array.isArray(rows) || rows.length === 0) return;
  const itemFields = Object.entries(group._item_fields);
  const numericFindings: FusionFinding[] = [];

  // PASS 1 — Anker je Zeile. Anker muessen EINDEUTIG sein: ziffernhaltige
  // Werte (Artikel-/Positionsnummern) statt Freitext — Beschreibungen
  // wiederholen Markenwoerter ("PHOENIX") ueber die Zeilen, der Fuzzy-Match
  // wuerde Woerter der Nachbarzeile greifen und die Banden zerschneiden.
  // Identische Anker-Werte (zwei Positionen, gleiche Artikelnummer) bekommen
  // der Reihe nach das 1., 2., ... Vorkommen auf der Seite.
  interface RowAnchor { pageWords: PageWords; box: NonNullable<ReturnType<typeof locateValue>>; fid: string }
  const occurrenceCounter = new Map<string, number>();
  const anchors: (RowAnchor | null)[] = rows.map((row) => {
    if (!row || typeof row !== 'object') return null;
    const cells = row as Record<string, unknown>;
    const anchorCandidates = itemFields
      .map(([fid, f]) => ({ fid, f, value: cells[fid] }))
      .filter((c) => c.value !== null && c.value !== undefined && c.value !== '' && c.f.type !== 'boolean')
      .map((c) => ({ ...c, n: norm(String(c.value)) }))
      .filter((c) => c.n.length >= 5 && isNumericLike(c.value, c.f.type))
      .sort((a, b) => b.n.length - a.n.length);
    for (const cand of anchorCandidates) {
      // Vollständige Vorkommen einsammeln,
      // ueber die Seiten in Lesereihenfolge.
      const occurrences: Array<{ pw: PageWords; wd: OcrWord }> = [];
      for (const pw of wordsByPage) {
        for (const wd of pw.words) {
          const nw = norm(wd.text);
          if (nw === cand.n) {
            occurrences.push({ pw, wd });
          }
        }
      }
      if (occurrences.length === 0) continue;
      const seen = occurrenceCounter.get(cand.n) ?? 0;
      if (seen >= occurrences.length) continue;
      const hit = occurrences[seen]!;
      occurrenceCounter.set(cand.n, seen + 1);
      const { pw, wd } = hit;
      return {
        pageWords: pw,
        fid: cand.fid,
        box: {
          x: wd.left / pw.page.width,
          y: wd.top / pw.page.height,
          w: wd.width / pw.page.width,
          h: wd.height / pw.page.height,
        },
      };
    }
    return null;
  });

  // PASS 2 — Zellen innerhalb der Zeilen-Bande suchen. Positionen koennen
  // MEHRZEILIG gedruckt sein (Sonepar: Menge ueber der Artikelnummer) — die
  // Bande ist deshalb grosszuegig (± 3 Ankerhoehen), wird aber durch die Anker
  // der NACHBARZEILEN auf derselben Seite begrenzt, damit kein Wert der
  // naechsten Position faelschlich als Beleg zaehlt.
  rows.forEach((row, idx) => {
    if (!row || typeof row !== 'object') return;
    const cells = row as Record<string, unknown>;
    const anchor = anchors[idx];
    if (!anchor) {
      for (const [fid, f] of itemFields) {
        if (cells[fid] != null && cells[fid] !== '' && isNumericLike(cells[fid], f.type)) {
          outcome.verdicts[`${groupName}[${idx}].${fid}`] = 'not_found_numeric';
          numericFindings.push({ path: `${groupName}[${idx}].${fid}`, message: `${group._label || groupName}, Zeile ${idx + 1}: kein eindeutiger OCR-Zeilenanker — Position prüfen.` });
        }
      }
      return;
    }

    const rowKey = (fid: string) => `${groupName}[${idx}].${fid}`;
    outcome.boxes[rowKey(anchor.fid)] = { page: anchor.pageWords.page.pageNumber, ...anchor.box };
    outcome.verdicts[rowKey(anchor.fid)] = 'located';

    const h = Math.max(anchor.box.h, 0.006);
    let bandTop = anchor.box.y - 3 * h;
    let bandBottom = anchor.box.y + anchor.box.h + 3 * h;
    for (const other of anchors) {
      if (!other || other === anchor) continue;
      if (other.pageWords.page.pageNumber !== anchor.pageWords.page.pageNumber) continue;
      // Nachbar unterhalb begrenzt nach unten, Nachbar oberhalb nach oben.
      if (other.box.y > anchor.box.y) bandBottom = Math.min(bandBottom, other.box.y - 0.5 * h);
      else if (other.box.y < anchor.box.y) bandTop = Math.max(bandTop, other.box.y + other.box.h + 0.5 * h);
    }
    const { page, words } = anchor.pageWords;

    for (const [fid, f] of itemFields) {
      if (fid === anchor.fid) continue;
      const value = cells[fid];
      const key = rowKey(fid);
      if (value === null || value === undefined || value === '' || f.type === 'boolean') {
        outcome.verdicts[key] = 'not_checkable';
        continue;
      }
      // Eine 0 steht auf dem Papier meist als LEERE Zelle ("Rueckstand: —") —
      // dass OCR sie nicht findet, ist normal und kein Befund.
      if (f.type === 'number' && Number(value) === 0) {
        outcome.verdicts[key] = 'not_checkable';
        continue;
      }
      const hit = findInBand(value, f.type === 'number', words, page.height, bandTop, bandBottom);
      if (hit) {
        outcome.boxes[key] = {
          page: page.pageNumber,
          x: hit.left / page.width,
          y: hit.top / page.height,
          w: hit.width / page.width,
          h: hit.height / page.height,
        };
        outcome.verdicts[key] = 'located';
      } else if (isNumericLike(value, f.type)) {
        outcome.verdicts[key] = 'not_found_numeric';
        numericFindings.push({
          path: key,
          message: `${group._label || groupName}, Zeile ${idx + 1}, ${f.label || fid}: Wert "${String(value)}" ist im OCR-Text der Zeile nicht belegt — bitte pruefen.`,
        });
      } else {
        outcome.verdicts[key] = 'not_found_text';
      }
    }
  });

  // Unbelegte Zahlen in der Liste: Befunde (gedeckelt gegen Flut) + Listen-Pfad
  // als "entschieden" markieren, damit die Strategie die Konfidenz deckelt.
  if (numericFindings.length > 0) {
    const MAX = 5;
    outcome.findings.push(...numericFindings.slice(0, MAX));
    if (numericFindings.length > MAX) {
      outcome.findings.push({
        path: groupName,
        message: `${group._label || groupName}: ${numericFindings.length - MAX} weitere unbelegte Zahlenwerte.`,
      });
    }
    outcome.verdicts[groupName] = 'not_found_numeric';
  }
}

/** Konfidenz-Anpassung aus den Fusion-Urteilen (Cap/Floor-Semantik). */
export function applyFusionToConfidences(
  confidences: Record<string, number>,
  outcome: FusionOutcome,
): void {
  if (!outcome.ocrRan) return;
  for (const [path, verdict] of Object.entries(outcome.verdicts)) {
    if (verdict === 'located' && path in confidences) {
      // Text occurrence does not establish label/column ownership. Never raise confidence.
      confidences[path] = Math.min(confidences[path] ?? 0, 0.7);
    } else if (verdict === 'not_found_numeric' && path in confidences) {
      // Deckel unter die Review-Schwelle (Default 0.6): Wert vorhanden, aber
      // nicht belegt → zur Pruefung. Kein hartes 0 — der Wert kann stimmen
      // (Handschrift liest Tesseract nicht).
      confidences[path] = Math.min(confidences[path] ?? 1, 0.4);
    }
  }
}
