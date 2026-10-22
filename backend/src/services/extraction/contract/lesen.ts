/**
 * Gemeinsamer Lesekern fuer `contract-structured` und `general-document`:
 * Seiten rendern → je Seite ueber das Bild transkribieren → digitale
 * PDF-Signaturen auslesen (parallel, mit Deckungspruefung) und als Marker
 * ergaenzen → Strukturbaum. Ein vorhandener Textlayer geht als
 * Hilfstext in die Transkription.
 */

import { extractionVisionDpi } from '../defaults';
import { renderPdfToImages, pdfToLayoutText } from '../pdf';
import type { PageImage, ProgressEmit } from '../types';
import { baueStruktur } from './struktur';
import { textlayerJeSeite, transkribiere, type SeitenBild } from './transkription';
import { ergaenzeDigitaleSignaturen, type PdfSignatur } from './signatur';
import { leseSignaturen } from './signatur-deckung';
import { pruefeUnterschriften } from './unterschriftspruefung';
import type { ModellKontext } from './modell';
import type { Klausel, SeitenTranskript, Volltext } from './types';

/** Mindestaufloesung fuer die Transkription (Kleingedrucktes in Vertraegen/Briefen). */
const LESE_DPI_MIN = 200;
/**
 * Aufloesung der Seitenbilder im Ergebnis (Pruefansicht). Bewusst niedriger als die Transkription: 200-dpi-Bilder
 * eines 89-seitigen Vertrags ergaben ~52 MB base64 und sprengten beim Speichern den Container (yneo, 2026-10-21).
 */
const VORSCHAU_DPI = Math.max(50, Number(process.env.EXTRACTION_VORSCHAU_DPI) || 100);

export interface GelesenesDokument {
  bilder: SeitenBild[];
  pageImages: PageImage[];
  seiten: SeitenTranskript[];
  klauseln: Klausel[];
  /** Zusaetzliche Modellaufrufe der Unterschriftspruefung (nur mit `unterschriftenPruefen`). */
  pruefAufrufe: number;
  /** Elektronische PDF-Signaturen mit Deckung (leer ohne Signatur). */
  signaturen: PdfSignatur[];
}

export async function leseDokument(
  kontext: ModellKontext,
  datei: { rawBuffer: Buffer; mimeType: string },
  opts: { maxSeiten: number; parallel: number; emit?: ProgressEmit; unterschriftenPruefen?: boolean },
): Promise<GelesenesDokument> {
  const istPdf = datei.mimeType === 'application/pdf';
  await opts.emit?.({ phase: 'preparing', message: 'Seiten werden gerendert' });
  let bilder: SeitenBild[];
  if (istPdf) {
    const pages = await renderPdfToImages(datei.rawBuffer, { dpi: Math.max(LESE_DPI_MIN, extractionVisionDpi()), maxPages: opts.maxSeiten });
    let layout: string[] = [];
    try { layout = textlayerJeSeite(await pdfToLayoutText(datei.rawBuffer)); } catch { /* kein Textlayer */ }
    bilder = pages.map((p) => ({ seite: p.pageNumber, png: p.pngBuffer, hilfstext: layout[p.pageNumber - 1] }));
  } else {
    bilder = [{ seite: 1, png: datei.rawBuffer }];
  }
  // Vorschau separat in niedriger Aufloesung (PDF); Bilder-Uploads und Rueckfall: die Lesebilder selbst.
  let vorschau: Array<{ seite: number; png: Buffer }> = bilder;
  if (istPdf) {
    try {
      const klein = await renderPdfToImages(datei.rawBuffer, { dpi: VORSCHAU_DPI, maxPages: opts.maxSeiten });
      if (klein.length === bilder.length) vorschau = klein.map((p) => ({ seite: p.pageNumber, png: p.pngBuffer }));
    } catch { /* Rueckfall auf die Lesebilder */ }
  }
  const pageImages: PageImage[] = vorschau.map((b) => ({
    page: b.seite,
    dataUri: `data:${datei.mimeType.startsWith('image/') ? datei.mimeType : 'image/png'};base64,${b.png.toString('base64')}`,
    width: b.png.length >= 24 ? b.png.readUInt32BE(16) : 0,
    height: b.png.length >= 24 ? b.png.readUInt32BE(20) : 0,
  }));
  // Signaturen sind reine Dateiarbeit (pdfsig/pdftotext) — parallel zur Transkription.
  const signaturenP = istPdf ? leseSignaturen(datei.rawBuffer).catch(() => [] as PdfSignatur[]) : Promise.resolve([] as PdfSignatur[]);
  const gelesen = await transkribiere(kontext, bilder, {
    parallel: opts.parallel,
    beiSeite: (fertig, gesamt) => opts.emit?.({ phase: 'extracting', chunkIndex: fertig - 1, chunkTotal: gesamt, pageIndex: fertig, pageTotal: gesamt }),
  });
  // Elektronische PDF-Signaturen stehen nicht im Seitenbild → als Marker an die Unterschriftsseite.
  const signaturen = await signaturenP;
  let seiten = ergaenzeDigitaleSignaturen(gelesen, signaturen);
  let pruefAufrufe = 0;
  if (opts.unterschriftenPruefen) {
    await opts.emit?.({ phase: 'preparing', message: 'Unterschriften werden geprüft' });
    const p = await pruefeUnterschriften(kontext, bilder, seiten, opts.parallel);
    seiten = p.seiten;
    pruefAufrufe = p.aufrufe;
  }
  return { bilder, pageImages, seiten, klauseln: baueStruktur(seiten), pruefAufrufe, signaturen };
}

/** Volltext fuer das Ergebnis: Transkript je Seite + Gliederung. */
export function alsVolltext(d: Pick<GelesenesDokument, 'seiten' | 'klauseln'> & { signaturen?: PdfSignatur[] }): Volltext {
  return {
    seiten: d.seiten.map((s) => ({ seite: s.seite, rolle: s.rolle, text: s.text, ...(s.fehler ? { fehler: s.fehler } : {}) })),
    gliederung: d.klauseln,
    ...(d.signaturen?.length ? { signaturen: d.signaturen } : {}),
  };
}
