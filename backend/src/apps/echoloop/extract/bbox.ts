/**
 * Koordinatenbasierte PDF-Extraktion via poppler `pdftotext -bbox`.
 *
 * Liefert je Seite die Wörter mit Bounding-Box (x/y). Das ist die Grundlage
 * für die Spalten-Raster-Extraktion der EMMA-Variablen-Tabelle (L-VAR) und die
 * präzisere Schritt-/Kommentar-Extraktion (L-RGA) — nativ, ohne Python/PyMuPDF
 * (poppler ist bereits Systemabhängigkeit im Backend).
 */

export interface BBoxWord {
  x: number; // xMin
  y: number; // yMin
  xMax: number;
  yMax: number;
  text: string;
}

export interface BBoxPage {
  nr: number;
  width: number;
  height: number;
  words: BBoxWord[];
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ENTITIES[e] ?? _);
}

/** Führt `pdftotext -bbox` aus und parst die Wörter je Seite. */
export async function pdfToBBox(bytes: Uint8Array): Promise<BBoxPage[]> {
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(['pdftotext', '-bbox', '-', '-'], { stdin: bytes, stdout: 'pipe', stderr: 'pipe' });
  } catch (e) {
    throw new Error('pdftotext (poppler-utils) nicht verfügbar: ' + (e as Error).message);
  }
  const xml = await new Response(proc.stdout as ReadableStream).text();
  const code = await proc.exited;
  if (code !== 0 && !xml.includes('<word')) {
    const err = await new Response(proc.stderr as ReadableStream).text();
    throw new Error(`pdftotext -bbox exit ${code}: ${err.slice(0, 200)}`);
  }

  const pages: BBoxPage[] = [];
  const pageRe = /<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g;
  const wordRe = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/word>/g;
  let pm: RegExpExecArray | null;
  let nr = 0;
  while ((pm = pageRe.exec(xml)) !== null) {
    nr++;
    const words: BBoxWord[] = [];
    const body = pm[3] ?? '';
    let wm: RegExpExecArray | null;
    while ((wm = wordRe.exec(body)) !== null) {
      const text = decodeEntities(wm[5] ?? '').trim();
      if (text) words.push({ x: +(wm[1] ?? 0), y: +(wm[2] ?? 0), xMax: +(wm[3] ?? 0), yMax: +(wm[4] ?? 0), text });
    }
    pages.push({ nr, width: +(pm[1] ?? 0), height: +(pm[2] ?? 0), words });
  }
  return pages;
}

/**
 * Gruppiert die Wörter einer Seite in Zeilen: Wörter, deren yMin nahe genug
 * beieinander liegen, bilden eine Zeile (nach x sortiert). `tol` = Toleranz in pt.
 */
export function zeilen(page: BBoxPage, tol = 3): BBoxWord[][] {
  const sorted = [...page.words].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: BBoxWord[][] = [];
  let cur: BBoxWord[] = [];
  let curY = -Infinity;
  for (const w of sorted) {
    if (cur.length && Math.abs(w.y - curY) > tol) {
      rows.push(cur.sort((a, b) => a.x - b.x));
      cur = [];
    }
    if (!cur.length) curY = w.y;
    cur.push(w);
  }
  if (cur.length) rows.push(cur.sort((a, b) => a.x - b.x));
  return rows;
}
