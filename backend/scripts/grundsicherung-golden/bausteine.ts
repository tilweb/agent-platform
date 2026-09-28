/**
 * Grundsicherung-Golden — Layout-Bausteine für die synthetischen Unterlagen (pdfmake, bereits
 * Backend-Dependency über den documentGenerator; keine neue Dependency).
 *
 * Jedes Dokument wird als eigene PDF gerendert (eigene Kopfzeile/Seitenzählung) und danach mit
 * `pdfunite` (poppler) zur Sammel-PDF zusammengesetzt. Alle Seiten tragen „MUSTER" im Kopf.
 */
import PdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, ContentTable, TDocumentDefinitions } from 'pdfmake/interfaces';

const fonts = pdfFonts as unknown as { pdfMake?: { vfs: Record<string, string> }; vfs?: Record<string, string> };
(PdfMake as unknown as { vfs: Record<string, string> }).vfs = fonts.pdfMake ? fonts.pdfMake.vfs : (fonts.vfs ?? (pdfFonts as unknown as Record<string, string>));

export const GRAU = '#555555';
export const HELLGRAU = '#e8e8e8';

// ── Format ──────────────────────────────────────────────────────────────────

/** 1234.5 → „1.234,50" */
export function eur(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
/** ISO → TT.MM.JJJJ */
export function dt(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
export const rund = (n: number) => Math.round(n * 100) / 100;

// ── Rendern ─────────────────────────────────────────────────────────────────

export interface DokumentRahmen {
  /** Kurzer Absender/Formularname links in der Kopfzeile. */
  kopfLinks: string;
  /** Titel rechts in der Fußzeile (z. B. „Antrag Grundsicherung"). */
  fussTitel: string;
  /** „Seite x von y" in der Fußzeile. */
  seitenzahl?: boolean;
  /** Seitenzählung im Kopf (Formulare: „Blatt x/y"). */
  blattImKopf?: boolean;
}

export async function renderDokument(inhalt: Content[], rahmen: DokumentRahmen, titel: string): Promise<Uint8Array> {
  const def: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [56, 62, 50, 56],
    info: { title: `${titel} (MUSTER)`, author: 'SYNTHETISCH — Grundsicherung Golden Dataset', subject: 'Synthetische Testunterlage, keine echten Personen', creator: 'grundsicherung-golden', producer: 'pdfmake' },
    defaultStyle: { fontSize: 9.5, lineHeight: 1.2 },
    header: (seite: number, gesamt: number) => ({
      margin: [56, 22, 50, 0],
      columns: [
        { text: rahmen.kopfLinks, fontSize: 7.5, color: GRAU },
        { text: rahmen.blattImKopf ? `Blatt ${seite}/${gesamt}` : '', fontSize: 7.5, color: GRAU, alignment: 'center' },
        { text: 'MUSTER · synthetische Testunterlage', fontSize: 7.5, bold: true, color: '#a00000', alignment: 'right' },
      ],
    }),
    footer: (seite: number, gesamt: number) => ({
      margin: [56, 16, 50, 0],
      columns: [
        { text: rahmen.fussTitel, fontSize: 7.5, color: GRAU },
        { text: rahmen.seitenzahl === false ? '' : `Seite ${seite} von ${gesamt}`, fontSize: 7.5, color: GRAU, alignment: 'right' },
      ],
    }),
    content: inhalt,
  };
  return new Promise((resolve, reject) => {
    try {
      // pdfmake 0.2 (Laufzeit) liefert den Puffer per Callback; die Typen beschreiben 0.3.
      (PdfMake.createPdf(def) as unknown as { getBuffer(cb: (b: Uint8Array) => void): void }).getBuffer((b) => resolve(new Uint8Array(b)));
    } catch (err) {
      reject(err);
    }
  });
}

// ── Formular-Elemente ───────────────────────────────────────────────────────

const duenn = {
  hLineWidth: () => 0.6, vLineWidth: () => 0.6, hLineColor: () => '#777777', vLineColor: () => '#777777',
  paddingLeft: () => 3, paddingRight: () => 3, paddingTop: () => 2, paddingBottom: () => 2,
};

/** Kästchen (angekreuzt = „X"). */
export function kaestchen(x: boolean): Content {
  return {
    table: { widths: [7], heights: [7], body: [[{ text: x ? 'X' : ' ', fontSize: 7, bold: true, alignment: 'center', margin: [0, -1.5, 0, -1.5] }]] },
    layout: { ...duenn, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
    width: 11,
  } as unknown as Content;
}

/** Ankreuzfeld mit Beschriftung. */
export function ankreuz(label: string, x: boolean, breite: number | '*' | 'auto' = 'auto'): Content {
  return { columns: [kaestchen(x), { text: label, fontSize: 9, margin: [3, 0, 0, 0], width: 'auto' }], columnGap: 0, width: breite } as unknown as Content;
}

/** Reihe von Ankreuzfeldern. */
export function ankreuzReihe(optionen: Array<[string, boolean]>, margin: [number, number, number, number] = [0, 2, 0, 4]): Content {
  return { columns: optionen.map(([l, x]) => ankreuz(l, x)), columnGap: 14, margin } as unknown as Content;
}

/** Formularfelder in einer Zeile: [Beschriftung, Wert, Breite]. */
export function feldZeile(felder: Array<[string, string | undefined, number | string]>, margin: [number, number, number, number] = [0, 0, 0, 3]): Content {
  return {
    table: {
      widths: felder.map(([, , b]) => b),
      body: [felder.map(([label, wert]) => ({
        stack: [
          { text: label, fontSize: 6.8, color: GRAU },
          { text: wert && wert.trim() ? wert : ' ', fontSize: 10, margin: [0, 1, 0, 0] },
        ],
      }))],
    },
    layout: duenn,
    margin,
  } as unknown as Content;
}

/** Tabelle mit Kopfzeile (Formular-/Aufstellungsstil). */
export function tabelle(kopf: string[], zeilen: Array<Array<string | Content>>, breiten: Array<number | string>, opts: { rechts?: number[]; fontSize?: number; margin?: [number, number, number, number] } = {}): ContentTable {
  const rechts = new Set(opts.rechts ?? []);
  const fs = opts.fontSize ?? 8.8;
  return {
    table: {
      headerRows: 1,
      widths: breiten,
      body: [
        kopf.map((k, i) => ({ text: k, bold: true, fontSize: fs - 0.6, fillColor: HELLGRAU, alignment: rechts.has(i) ? 'right' : 'left' })),
        ...zeilen.map((z) => z.map((c, i) => (typeof c === 'string' ? { text: c, fontSize: fs, alignment: rechts.has(i) ? 'right' : 'left' } : c))),
      ],
    },
    layout: duenn,
    margin: opts.margin ?? [0, 2, 0, 6],
  } as ContentTable;
}

/** Nummerierter Formularabschnitt (graue Leiste). */
export function abschnitt(nr: number | string, titel: string, pageBreak = false): Content {
  return {
    table: { widths: ['*'], body: [[{ text: `${nr}. ${titel}`, bold: true, fontSize: 10.5, fillColor: '#d9d9d9', margin: [2, 2, 2, 2] }]] },
    layout: 'noBorders',
    margin: [0, 8, 0, 4],
    ...(pageBreak ? { pageBreak: 'before' } : {}),
  } as unknown as Content;
}

export const klein = (t: string, margin: [number, number, number, number] = [0, 0, 0, 4]): Content => ({ text: t, fontSize: 7.8, color: '#333333', margin, alignment: 'justify' });
export const absatz = (t: string | Content[], margin: [number, number, number, number] = [0, 0, 0, 6]): Content => ({ text: t, margin, alignment: 'justify' } as Content);
export const ueberschrift = (t: string, margin: [number, number, number, number] = [0, 6, 0, 6]): Content => ({ text: t, bold: true, fontSize: 12.5, margin });
export const zwischen = (t: string): Content => ({ text: t, bold: true, fontSize: 10, margin: [0, 8, 0, 3] });

/** Handschriftliche Unterschrift (gezeichnete Linie, deterministisch aus `saat`). */
export function unterschrift(saat: number, breite = 150): Content {
  let s = saat * 9301 + 49297;
  const zufall = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const punkte: Array<{ x: number; y: number }> = [];
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const x = 6 + (i / n) * (breite - 20);
    const y = 18 + Math.sin(i * 1.3 + saat) * (6 + zufall() * 5) - (i < 4 ? i * 2 : 0);
    punkte.push({ x, y });
  }
  return {
    canvas: [
      { type: 'polyline', lineWidth: 1.3, lineColor: '#1a2b8c', points: punkte },
      { type: 'line', x1: 10, y1: 26 + zufall() * 3, x2: breite * 0.55, y2: 22 + zufall() * 3, lineWidth: 1, lineColor: '#1a2b8c' },
    ],
    margin: [0, 2, 0, 0],
  } as unknown as Content;
}

/** Unterschriftsfeld: Ort/Datum, Linie, Beschriftung — mit oder ohne gezeichnete Unterschrift. */
export function unterschriftsfeld(ortDatum: string | undefined, beschriftung: string, saat: number | null): Content {
  return {
    columns: [
      { width: 170, stack: [{ text: ortDatum ?? ' ', fontSize: 10, margin: [0, 22, 0, 0] }, { canvas: [{ type: 'line', x1: 0, y1: 2, x2: 160, y2: 2, lineWidth: 0.6 }] }, { text: 'Ort, Datum', fontSize: 7, color: GRAU }] },
      { width: 230, stack: [saat === null ? { text: ' ', margin: [0, 30, 0, 0] } : unterschrift(saat), { canvas: [{ type: 'line', x1: 0, y1: 2, x2: 220, y2: 2, lineWidth: 0.6 }] }, { text: beschriftung, fontSize: 7, color: GRAU }] },
    ],
    columnGap: 20,
    margin: [0, 4, 0, 8],
  } as unknown as Content;
}

// ── Briefe ──────────────────────────────────────────────────────────────────

export interface Brief {
  absender: string;            // „Deutsche Rentenversicherung Hessen"
  absenderZusatz?: string[];   // Anschrift, Telefon …
  ruecksende: string;          // kleine Absenderzeile über dem Adressfeld
  empfaenger: string[];        // „Frau", „Erika Schmidt", „Lindenweg 7", „34117 Kassel"
  infoblock: Array<[string, string]>; // rechts: Zeichen, Datum …
}

/** Briefkopf mit Adressfeld und Infoblock (DIN-5008-nah). */
export function briefkopf(b: Brief): Content[] {
  return [
    {
      columns: [
        { width: '*', stack: [{ text: b.absender, bold: true, fontSize: 13 }, ...(b.absenderZusatz ?? []).map((z) => ({ text: z, fontSize: 8, color: GRAU }))] },
      ],
      margin: [0, 0, 0, 16],
    },
    {
      columns: [
        {
          width: 250,
          stack: [
            { text: b.ruecksende, fontSize: 6.5, color: GRAU, decoration: 'underline', margin: [0, 0, 0, 4] },
            ...b.empfaenger.map((z) => ({ text: z, fontSize: 10 })),
          ],
        },
        {
          width: '*',
          table: { widths: [88, '*'], body: b.infoblock.map(([k, v]) => [{ text: k, fontSize: 7.5, color: GRAU }, { text: v, fontSize: 8.5 }]) },
          layout: 'noBorders',
        },
      ],
      margin: [0, 0, 0, 22],
    },
  ] as Content[];
}

/** Betreffzeile eines Briefs. */
export const betreff = (t: string, unter?: string): Content => ({ stack: [{ text: t, bold: true, fontSize: 11.5 }, ...(unter ? [{ text: unter, fontSize: 9, margin: [0, 1, 0, 0] }] : [])], margin: [0, 0, 0, 10] } as Content);

/** Zweispaltige Aufstellung (Bezeichnung … Betrag). */
export function aufstellung(zeilen: Array<[string, string, boolean?]>, breite = 340): Content {
  return {
    table: { widths: [breite - 110, 100], body: zeilen.map(([l, w, fett]) => [{ text: l, bold: !!fett, fontSize: 9.5 }, { text: w, bold: !!fett, fontSize: 9.5, alignment: 'right' }]) },
    layout: { hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === node.table.body.length - 1 ? 0.6 : 0), vLineWidth: () => 0, paddingTop: () => 2, paddingBottom: () => 2 },
    margin: [0, 2, 0, 10],
  } as unknown as Content;
}

/** Kasten (Ausweis, Stempel …). */
export function kasten(inhalt: Content[], breite: number | '*' = '*', fill?: string): Content {
  return {
    table: { widths: [breite], body: [[{ stack: inhalt, ...(fill ? { fillColor: fill } : {}) }]] },
    layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#444', vLineColor: () => '#444', paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 6, paddingBottom: () => 6 },
    margin: [0, 4, 0, 10],
  } as unknown as Content;
}
