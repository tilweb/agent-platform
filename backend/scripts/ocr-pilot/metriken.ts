/**
 * OCR-Pilot Stufe A — reine Bewertungsfunktionen (ohne IO).
 *
 * Referenz ist der Textlayer der DIGITALEN Fassung desselben Golden-Falls (gleiche Seiten wie der Scan).
 * Verglichen wird als Wort-Multimenge (reihenfolgeunabhängig, robust gegen Layout- und Markdown-Unterschiede):
 * - Wort-Recall: Anteil der Referenzwörter, die die OCR liefert (Vollständigkeit)
 * - Wort-Präzision: Anteil der OCR-Wörter, die in der Referenz stehen (keine Halluzinationen/Müll)
 * - Zahlen-Recall: wie Recall, nur Tokens mit Ziffern (Beträge, Daten, IBAN, PLZ) — die kritischen Werte
 */

/** Entfernt Auszeichnung von OCR-Modellen: HTML-Tabellen, Markdown, DeepSeek-Grounding, LaTeX-Reste. */
export function entferneAuszeichnung(s: string): string {
  return s
    .replace(/<\|ref\|>([\s\S]*?)<\|\/ref\|>/g, '$1')
    .replace(/<\|det\|>[\s\S]*?<\|\/det\|>/g, ' ')
    .replace(/<\|[a-z_/]+\|>/gi, ' ')
    .replace(/<\/?(table|thead|tbody|tr|td|th|br|p|div|span|b|i|u|sup|sub)[^>]*>/gi, ' ')
    .replace(/\\\(|\\\)|\\\[|\\\]|\$\$?/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#*_`>|~]+/g, ' ');
}

/** Tokens: Kleinschreibung, Unicode-normalisiert; Zahlen ohne Tausenderpunkte/Leerzeichen zwischen Ziffern. */
export function tokens(s: string): string[] {
  const t = entferneAuszeichnung(s)
    .normalize('NFC')
    .toLowerCase()
    // Ziffernfolgen mit Tausendertrennern / Leerzeichen zusammenziehen: „2.640,00" → „2640,00", „DE12 3456" bleibt getrennt
    .replace(/(\d)\.(?=\d{3}\b)/g, '$1')
    .replace(/[„“”"'‚‘’«»()\[\]{}:;!?]/g, ' ')
    .replace(/(^|\s)[-–—•·]+(?=\s|$)/g, ' ');
  return t.split(/\s+/)
    .map((w) => w.replace(/^[.,/-]+|[.,/-]+$/g, ''))
    .filter((w) => w.length > 0);
}

export const hatZiffer = (w: string) => /\d/.test(w);

/** Multimengen-Schnitt: wie viele Tokens aus `a` kommen (mit Vielfachheit) in `b` vor. */
function schnitt(a: string[], b: string[]): number {
  const zaehler = new Map<string, number>();
  for (const w of b) zaehler.set(w, (zaehler.get(w) ?? 0) + 1);
  let n = 0;
  for (const w of a) {
    const c = zaehler.get(w) ?? 0;
    if (c > 0) { n++; zaehler.set(w, c - 1); }
  }
  return n;
}

export interface SeitenMetrik {
  refWoerter: number;
  ocrWoerter: number;
  treffer: number;
  refZahlen: number;
  zahlenTreffer: number;
}

export function vergleicheSeite(referenz: string, ocr: string): SeitenMetrik {
  const r = tokens(referenz);
  const o = tokens(ocr);
  const rz = r.filter(hatZiffer);
  const oz = o.filter(hatZiffer);
  return { refWoerter: r.length, ocrWoerter: o.length, treffer: schnitt(r, o), refZahlen: rz.length, zahlenTreffer: schnitt(rz, oz) };
}

export interface Summe { recall: number; praezision: number; zahlenRecall: number; f1: number }

export function summiere(m: SeitenMetrik[]): Summe {
  const s = m.reduce((a, x) => ({ r: a.r + x.refWoerter, o: a.o + x.ocrWoerter, t: a.t + x.treffer, rz: a.rz + x.refZahlen, tz: a.tz + x.zahlenTreffer }), { r: 0, o: 0, t: 0, rz: 0, tz: 0 });
  const recall = s.r ? s.t / s.r : 0;
  const praezision = s.o ? s.t / s.o : 0;
  return { recall, praezision, zahlenRecall: s.rz ? s.tz / s.rz : 0, f1: recall + praezision ? (2 * recall * praezision) / (recall + praezision) : 0 };
}

/**
 * Wiederholungsschleife (bekanntes Fehlerbild kleiner OCR-VLMs): eine Zeile (≥ 10 Zeichen, also keine Kästchen/Pfeile)
 * steht ≥ 8× in den letzten 60 Zeilen UND deutlich öfter als in der Referenz — oder die Ausgabe ist mehr als doppelt so lang wie die Referenz — legitime Wiederholungen
 * (Kontoauszug-Buchungen, Formularzeilen „Betrag in EUR/Monat") zählen so nicht als Schleife.
 */
export function hatSchleife(ocr: string, referenz?: string): boolean {
  const norm = (z: string) => entferneAuszeichnung(z).replace(/[☐☑☒▶►■□✓✔]/g, ' ').toLowerCase().replace(/\s+/g, ' ').trim();
  const zeilen = ocr.split('\n').map(norm).filter((z) => z.length >= 10).slice(-60);
  const n = new Map<string, number>();
  for (const z of zeilen) n.set(z, (n.get(z) ?? 0) + 1);
  const ref = referenz != null ? norm(referenz.replace(/\n/g, ' ')) : null;
  if ([...n].some(([z, c]) => c >= 8 && (ref == null || c > ref.split(z).length - 1 + 3))) return true;
  // Block-Schleife (mehrere kurze Zeilen wiederholt, z. B. „Betrag EUR / 1.180,00 / …"): Ausgabe mehr als doppelt so lang wie die Seite
  return referenz != null && tokens(ocr).length > 2 * tokens(referenz).length + 50;
}
