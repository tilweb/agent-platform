/**
 * Digitale PDF-Signaturen (Signaturfelder) — stehen nicht im Seitenbild.
 *
 * Ein signiertes Feld ist ein `/Type /Sig`-Dictionary mit `/M` (Signaturzeit)
 * und nicht-leerem `/Contents` (PKCS#7). Der Unterzeichner steht nur im
 * Zertifikat und ist nicht verlaesslich lesbar — die Zuordnung zur Partei
 * trifft das Modell ueber Ort/Datum im Unterschriftsbereich.
 */

import type { SeitenTranskript } from './types';

export interface DigitaleSignatur { zeit: string }

/** „D:20240725151833+02'00'" → „25.07.2024 15:18". */
function pdfZeit(roh: string): string {
  const m = /D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?/.exec(roh);
  if (!m) return roh;
  return `${m[3]}.${m[2]}.${m[1]}${m[4] ? ` ${m[4]}:${m[5] ?? '00'}` : ''}`;
}

export function findeDigitaleSignaturen(pdf: Buffer): DigitaleSignatur[] {
  const text = pdf.toString('latin1');
  const out: DigitaleSignatur[] = [];
  for (const m of text.matchAll(/\/Type\s*\/Sig\b/g)) {
    // Bis zum Objektende lesen — das Dictionary enthaelt verschachtelte << >> (Prop_Build) und lange Hex-Inhalte.
    const start = Math.max(0, text.lastIndexOf('obj', m.index ?? 0));
    const ende = text.indexOf('endobj', m.index ?? 0);
    const dict = text.slice(start, ende > 0 ? ende : (m.index ?? 0) + 60_000);
    const inhalt = /\/Contents\s*<([0-9a-fA-F]*)>/.exec(dict)?.[1] ?? '';
    if (!/[1-9a-fA-F]/.test(inhalt)) continue; // leeres (unsigniertes) Signaturfeld
    const zeit = /\/M\s*\(([^)]*)\)/.exec(dict)?.[1];
    out.push({ zeit: zeit ? pdfZeit(zeit) : 'Zeitpunkt unbekannt' });
  }
  return out;
}

/** Marker an die Unterschriftsseite (sonst letzte Vertragsseite) anhaengen — ohne das Transkript selbst zu aendern. */
export function ergaenzeDigitaleSignaturen(seiten: SeitenTranskript[], signaturen: DigitaleSignatur[]): SeitenTranskript[] {
  if (!signaturen.length) return seiten;
  const kandidaten = seiten.filter((s) => !s.fehler && s.rolle === 'unterschriften');
  const ziel = kandidaten[kandidaten.length - 1] ?? [...seiten].reverse().find((s) => !s.fehler && ['vertragstext', 'deckblatt'].includes(s.rolle));
  if (!ziel) return seiten;
  const zeilen = signaturen.map((s) => `{{digitale signatur: im PDF elektronisch signiert am ${s.zeit}}}`).join('\n');
  return seiten.map((s) => (s === ziel ? { ...s, text: `${s.text}\n\n${zeilen}` } : s));
}
