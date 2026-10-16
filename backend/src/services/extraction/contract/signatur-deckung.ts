/**
 * Deckt eine PDF-Signatur das Dokument ab — oder wurde danach noch etwas geaendert?
 *
 * Signaturen werden als inkrementelles Update angehaengt: Die signierte Fassung ist
 * das Dateipraefix bis zum Ende der signierten Byte-Bereiche. Wir vergleichen diese
 * Fassung mit der naechsten (naechste Signatur bzw. Enddatei):
 *   - Seitenzahl und Text je Seite (pdfinfo/pdftotext, schon im Lesekern genutzt),
 *   - nur nach der LETZTEN Signatur zusaetzlich das Seitenbild in niedriger Aufloesung
 *     (`pdftoppm -gray`, PGM-Rohpixel) — Anmerkungen, Stempel und Formularfelder sieht
 *     pdftotext nicht. Zwischen zwei Signaturen bleibt das Bild ungewertet: Das
 *     Erscheinungsbild der zweiten Signatur veraendert die Seite zwangslaeufig.
 */

import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { countPdfPages, pdfToLayoutText } from '../pdf';
import { textlayerJeSeite } from './transkription';
import { alsSignatur, findeDigitaleSignaturen, lesePdfsig, type PdfSignatur, type SignaturAenderung } from './signatur';

/** Aufloesung des Bildvergleichs — reicht fuer Text-Anmerkungen, kostet wenig. */
const VERGLEICH_DPI = 40;
/** Grauwert-Differenz, ab der ein Pixel als geaendert zaehlt (Rendering ist deterministisch). */
const PIXEL_SCHWELLE = 40;
/** Mindestzahl geaenderter Pixel je Seite. */
const MIN_PIXEL = 12;

function norm(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Woerter aus `b`, die in `a` nicht (so oft) vorkommen — in Reihenfolge von `b`. */
export function wortDifferenz(a: string, b: string, max = 12): string[] {
  const rest = new Map<string, number>();
  for (const w of a.split(' ').filter(Boolean)) rest.set(w, (rest.get(w) ?? 0) + 1);
  const out: string[] = [];
  for (const w of b.split(' ').filter(Boolean)) {
    const n = rest.get(w) ?? 0;
    if (n > 0) rest.set(w, n - 1);
    else if (out.push(w) >= max) break;
  }
  return out;
}

async function textJeSeite(pdf: Buffer): Promise<string[]> {
  try {
    return textlayerJeSeite(await pdfToLayoutText(pdf)).map(norm);
  } catch {
    return [];
  }
}

/** PGM (P5) → Breite, Hoehe, Pixel. */
export function parsePgm(buf: Buffer): { w: number; h: number; px: Buffer } | null {
  const kopf = /^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(buf.subarray(0, 64).toString('latin1'));
  if (!kopf) return null;
  const w = Number(kopf[1]);
  const h = Number(kopf[2]);
  return { w, h, px: buf.subarray(kopf[0].length, kopf[0].length + w * h) };
}

/** Zaehlt deutlich abweichende Pixel; verschiedene Groessen gelten als geaendert. */
export function bildGeaendert(a: Buffer, b: Buffer): boolean {
  const x = parsePgm(a);
  const y = parsePgm(b);
  if (!x || !y) return false;
  if (x.w !== y.w || x.h !== y.h) return true;
  let n = 0;
  for (let i = 0; i < x.px.length; i++) {
    if (Math.abs(x.px[i]! - y.px[i]!) > PIXEL_SCHWELLE && ++n >= MIN_PIXEL) return true;
  }
  return false;
}

async function seitenbilder(pdf: Buffer, dir: string, name: string): Promise<Buffer[]> {
  const pfad = join(dir, `${name}.pdf`);
  await Bun.write(pfad, pdf);
  const proc = Bun.spawn(['pdftoppm', '-gray', '-r', String(VERGLEICH_DPI), pfad, join(dir, name)], { stdout: 'pipe', stderr: 'pipe' });
  const timer = setTimeout(() => proc.kill(), 60_000);
  try { await proc.exited; } finally { clearTimeout(timer); }
  const dateien = (await readdir(dir))
    .map((f) => ({ f, n: new RegExp(`^${name}-(\\d+)\\.pgm$`).exec(f)?.[1] }))
    .filter((x) => x.n)
    .sort((p, q) => Number(p.n) - Number(q.n));
  return Promise.all(dateien.map((x) => readFile(join(dir, x.f))));
}

async function sichtbarGeaenderteSeiten(alt: Buffer, neu: Buffer): Promise<number[]> {
  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), 'dp-sigvergleich-'));
    const [a, b] = await Promise.all([seitenbilder(alt, dir, 'alt'), seitenbilder(neu, dir, 'neu')]);
    const out: number[] = [];
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (bildGeaendert(a[i]!, b[i]!)) out.push(i + 1);
    return out;
  } catch {
    return [];
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Vergleicht signierte Fassung mit spaeterer Fassung. `null` = keine erkennbare Aenderung. */
export async function vergleicheFassungen(signiert: Buffer, spaeter: Buffer, opts: { bild: boolean }): Promise<SignaturAenderung | null> {
  const [nA, nB, tA, tB] = await Promise.all([countPdfPages(signiert), countPdfPages(spaeter), textJeSeite(signiert), textJeSeite(spaeter)]);
  const art = new Set<SignaturAenderung['art'][number]>();
  const seiten = new Set<number>();
  const hinzu: string[] = [];
  const entfernt: string[] = [];
  if (nA && nB && nA !== nB) {
    art.add('seiten');
    for (let s = Math.min(nA, nB) + 1; s <= Math.max(nA, nB); s++) if (s <= nB) seiten.add(s);
  }
  for (let i = 0; i < Math.min(tA.length, tB.length, nA || Infinity, nB || Infinity); i++) {
    if (tA[i] === tB[i]) continue;
    art.add('text');
    seiten.add(i + 1);
    hinzu.push(...wortDifferenz(tA[i]!, tB[i]!));
    entfernt.push(...wortDifferenz(tB[i]!, tA[i]!));
  }
  if (opts.bild) {
    for (const s of await sichtbarGeaenderteSeiten(signiert, spaeter)) {
      if (!seiten.has(s)) { art.add('sichtbar'); seiten.add(s); }
    }
  }
  if (!art.size) return null;
  return {
    seiten: [...seiten].sort((x, y) => x - y),
    ...(nA && nB && nA !== nB ? { seitenzahl: [nA, nB] as [number, number] } : {}),
    art: [...art],
    ...(hinzu.length ? { hinzu: hinzu.slice(0, 12).join(' ') } : {}),
    ...(entfernt.length ? { entfernt: entfernt.slice(0, 12).join(' ') } : {}),
  };
}

/** Deckung je Signatur bestimmen (Signaturen in Dateireihenfolge). */
export async function bestimmeDeckung(pdf: Buffer, signaturen: PdfSignatur[]): Promise<PdfSignatur[]> {
  const sortiert = [...signaturen].sort((a, b) => a.bereich_ende - b.bereich_ende);
  const out: PdfSignatur[] = [];
  for (let i = 0; i < sortiert.length; i++) {
    const s = sortiert[i]!;
    // Abschluss-Zeilenumbruch nach %%EOF zaehlt nicht als Aenderung.
    if (s.deckung === 'vollstaendig' || (s.bereich_ende > 0 && pdf.length - s.bereich_ende <= 2)) {
      out.push({ ...s, deckung: 'vollstaendig' });
      continue;
    }
    if (!s.bereich_ende || s.bereich_ende > pdf.length) { out.push({ ...s, deckung: 'unbekannt' }); continue; }
    const naechste = sortiert.slice(i + 1).find((x) => x.bereich_ende > s.bereich_ende);
    const signiert = pdf.subarray(0, s.bereich_ende);
    const spaeter = naechste ? pdf.subarray(0, naechste.bereich_ende) : pdf;
    try {
      const aenderung = await vergleicheFassungen(signiert, spaeter, { bild: !naechste });
      if (aenderung) out.push({ ...s, deckung: 'geaendert', aenderung });
      else out.push({ ...s, deckung: naechste ? 'spaetere_signatur' : 'nachtrag_ohne_aenderung' });
    } catch {
      out.push({ ...s, deckung: 'unbekannt' });
    }
  }
  return out;
}

/**
 * Alle Signaturen einer PDF mit Deckung. Ohne `/ByteRange` gibt es keine Signatur → kein Prozessstart.
 * Ohne nutzbares `pdfsig` Rueckfall auf den Byte-Scan (nur Zeitpunkt, Deckung unbekannt).
 */
export async function leseSignaturen(pdf: Buffer): Promise<PdfSignatur[]> {
  if (!pdf.includes('/ByteRange')) return [];
  const roh = await lesePdfsig(pdf);
  if (roh === null) {
    return findeDigitaleSignaturen(pdf).map((s, i) => ({
      feld: `Signatur ${i + 1}`, zeit: s.zeit, art: 'sonstige', integritaet: 'unbekannt', bereich_ende: 0, deckung: 'unbekannt',
    }));
  }
  return bestimmeDeckung(pdf, roh.map(alsSignatur));
}
