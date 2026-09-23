/**
 * Gemeinsame Helfer des Golden-Dataset-Generators: reproduzierbarer Zufall,
 * deutsche Formate, IBAN-Prüfziffer, HTML→PDF über Chrome (headless) mit Cache,
 * gezeichnete Unterschrift.
 */
import { mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

export const ROOT = join(import.meta.dir, '..');
export const REPO = join(ROOT, '..', '..');
export const VORLAGEN = join(REPO, 'docs', 'wohngeld', 'synth-antraege');
export const OUT = join(ROOT, 'out');

// ── Zufall (seeded, reproduzierbar je Fall) ─────────────────────────────────

export type Rng = () => number;

/** mulberry32 — kleiner, deterministischer PRNG. */
export function rng(seed: string): Rng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const zwischen = (r: Rng, min: number, max: number) => min + r() * (max - min);
export const ganz = (r: Rng, min: number, max: number) => Math.floor(zwischen(r, min, max + 1));
export const wahl = <T,>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;

// ── Formate ─────────────────────────────────────────────────────────────────

/** 1234.5 → "1.234,50" */
export function eur(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** ISO "2026-08-14" → "14.08.2026" */
export function datum(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** Monat "2026-08" → "August 2026" */
export function monatName(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1)).toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Tage im Monat "2026-08" → 31 */
export function tageImMonat(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

/** Monat verschieben: ("2026-08", -2) → "2026-06" */
export function monatPlus(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const rund2 = (n: number) => Math.round(n * 100) / 100;

/** HTML-Escaping für Template-Werte. */
export function esc(s: string | number | undefined | null): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── IBAN ────────────────────────────────────────────────────────────────────

/** Deutsche IBAN mit gültiger Prüfziffer aus (fiktiver) BLZ + Kontonummer. */
export function iban(blz: string, konto: string): string {
  const bban = blz.padStart(8, '0') + konto.padStart(10, '0');
  const num = bban + '131400'; // D=13, E=14, Prüfziffer 00
  let rest = 0;
  for (const ch of num) rest = (rest * 10 + Number(ch)) % 97;
  const pz = String(98 - rest).padStart(2, '0');
  return `DE${pz}${bban}`;
}

/** "DE12345..." → "DE12 3456 ..." */
export const ibanFormat = (i: string) => i.replace(/(.{4})/g, '$1 ').trim();

// ── HTML → PDF (Chrome headless) ────────────────────────────────────────────

const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** Gemeinsames Grund-CSS für alle Nachweise (A4, druckgenau). */
export const BASIS_CSS = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111; }
  .seite { width: 210mm; height: 297mm; padding: 18mm 20mm 16mm 22mm; position: relative; overflow: hidden; page-break-after: always; }
  .seite:last-child { page-break-after: auto; }
  table { border-collapse: collapse; width: 100%; }
  td, th { vertical-align: top; }
  .r { text-align: right; }
  .klein { font-size: 8pt; color: #444; }
  .fett { font-weight: bold; }
`;

/**
 * Rendert HTML zu PDF über Chrome (headless). Ergebnisse werden per Inhalts-Hash
 * in out/.cache abgelegt — erneute Läufe sind schnell.
 */
export async function htmlZuPdf(html: string): Promise<Uint8Array> {
  const hash = new Bun.CryptoHasher('sha256').update(html).digest('hex').slice(0, 24);
  const cacheDir = join(OUT, '.cache');
  await mkdir(cacheDir, { recursive: true });
  const pdfPath = join(cacheDir, `${hash}.pdf`);
  const f = Bun.file(pdfPath);
  if (await f.exists()) return new Uint8Array(await f.arrayBuffer());

  const htmlPath = join(cacheDir, `${hash}.html`);
  await Bun.write(htmlPath, html);
  const tmpPdf = `${pdfPath}.tmp`;
  const proc = Bun.spawn([
    CHROME, '--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--no-first-run',
    '--no-default-browser-check', '--disable-extensions',
    `--user-data-dir=${join(cacheDir, `chrome-profile-${hash}`)}`,
    `--print-to-pdf=${tmpPdf}`, `file://${htmlPath}`,
  ], { stdout: 'ignore', stderr: 'ignore' });
  // Chrome beendet sich nicht immer selbst — auf die fertige Datei warten, dann beenden.
  const start = Date.now();
  let letzteGroesse = -1;
  let stabil = 0;
  while (Date.now() - start < 60_000) {
    await Bun.sleep(150);
    const f2 = Bun.file(tmpPdf);
    const groesse = (await f2.exists()) ? f2.size : -1;
    if (groesse > 0 && groesse === letzteGroesse) { if (++stabil >= 3) break; } else stabil = 0;
    letzteGroesse = groesse;
    if (proc.exitCode !== null && groesse <= 0) break;
  }
  proc.kill();
  await rm(join(cacheDir, `chrome-profile-${hash}`), { recursive: true, force: true }).catch(() => {});
  if (!(await Bun.file(tmpPdf).exists()) || Bun.file(tmpPdf).size === 0) throw new Error('Chrome-Druck fehlgeschlagen (keine PDF erzeugt)');
  await rename(tmpPdf, pdfPath);
  return new Uint8Array(await Bun.file(pdfPath).arrayBuffer());
}

/** Standard-HTML-Hülle. */
export function htmlDoc(body: string, extraCss = ''): string {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>${BASIS_CSS}${extraCss}</style></head><body>${body}</body></html>`;
}

// ── Unterschrift ────────────────────────────────────────────────────────────

/**
 * Erzeugt einen SVG-Pfad, der wie eine flüchtige Unterschrift aussieht
 * (Bogenfolge, deterministisch aus dem Namen). Koordinaten in einem Feld
 * von ca. 150 × 40 Einheiten, y nach unten.
 */
export function unterschriftPfad(name: string): string {
  const r = rng(`sig:${name}`);
  // Anfangsbuchstabe: hoher Aufstrich mit Schleife
  let x = 6;
  let y = 30;
  const h = zwischen(r, 0, 10);
  const b = zwischen(r, -4, 6);
  let d = `M ${x} ${y} C ${(2 + b).toFixed(1)} ${(8 + h).toFixed(1)} ${(18 + b).toFixed(1)} ${(h * 0.5).toFixed(1)} ${(16 + b * 0.5).toFixed(1)} ${(18 + h * 0.3).toFixed(1)} C 15 28 8 34 12 30`;
  x = 14; y = 28;
  const zuege = 6 + ganz(r, 0, 4);
  for (let i = 0; i < zuege; i++) {
    const dx = zwischen(r, 8, 16);
    const hoch = zwischen(r, 6, 18);
    const schleife = r() < 0.35;
    const nx = x + dx;
    const ny = 28 + zwischen(r, -3, 3);
    if (schleife) {
      // kleine Schleife (Kontrollpunkte kreuzen sich)
      d += ` C ${(x + dx * 1.1).toFixed(1)} ${(y - hoch).toFixed(1)} ${(x - dx * 0.2).toFixed(1)} ${(y - hoch).toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)}`;
    } else {
      d += ` C ${(x + dx * 0.3).toFixed(1)} ${(y - hoch).toFixed(1)} ${(x + dx * 0.7).toFixed(1)} ${(y + hoch * 0.25).toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)}`;
    }
    x = nx; y = ny;
  }
  // Abschwung und Unterstreichung
  d += ` C ${(x + 6).toFixed(1)} ${(y + 10).toFixed(1)} ${(x * 0.5).toFixed(1)} 42 ${(8 + r() * 6).toFixed(1)} 38`;
  return d;
}

/** Unterschrift als Inline-SVG für HTML-Nachweise. */
export function unterschriftSvg(name: string, breiteMm = 45): string {
  return `<svg viewBox="0 0 170 44" style="width:${breiteMm}mm;height:${(breiteMm * 44) / 170}mm;overflow:visible"><path d="${unterschriftPfad(name)}" fill="none" stroke="#1a2a6c" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}
