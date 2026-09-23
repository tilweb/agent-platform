/**
 * Wohngeld — Mehrdokument-Split im Posteingang.
 *
 * Eine Sammel-PDF (Antrag + Nachweise in einer Datei) wird an Dokumentgrenzen in
 * eigenständige Teil-PDFs getrennt. Nutzt die Plattform-Bausteine der
 * Document-Processing-Inbox wieder (Grenz-Urteil per Vision, Seitenbereiche,
 * poppler-Teil-PDFs) — keine eigene Grenzerkennung.
 *
 * Spec: docs/wohngeld-posteingang-mehrdok-split-spec-2026-09-23.md
 *
 * Aufbau: reine Helfer (testbar, ohne IO) oben, IO-Funktionen mit injizierbaren
 * Abhängigkeiten unten.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { judgeBoundaries, rangesFromBoundaries } from '../../extraction/inbox/split';
import { extractionModelLabel } from '../../extraction/model';
import { buildPartPdf, isPdfSplitterAvailable } from '../../services/extraction/pdf-split';
import { countPdfPages, renderPdfToImages, type PdfPageImage } from '../../services/extraction/pdf';
import { storeUpload, resolveStorageRef, loadDokumentDatei } from './filestore';
import { sha256Hex } from './posteingang-helpers';
import type { PosteingangDatei, PosteingangTeilVon, PosteingangTrennung } from './types';

export type SeitenBereich = { from: number; to: number };

/** Split global abschaltbar (z. B. Instanz ohne Vision-Modell). Default an. */
export function splitAktiv(): boolean {
  return (process.env.WOHNGELD_SPLIT ?? 'true').toLowerCase() !== 'false';
}

/** Obergrenze für die automatische Grenzprüfung (ein Vision-Call je Seitenübergang). */
export function splitMaxSeiten(): number {
  const n = parseInt(process.env.WOHNGELD_SPLIT_MAX_SEITEN || '40', 10);
  return Number.isFinite(n) && n > 1 ? n : 40;
}

// ── Reine Helfer ─────────────────────────────────────────────────────────────

export function istPdf(d: Pick<PosteingangDatei, 'contentType' | 'dateiname'>): boolean {
  return d.contentType === 'application/pdf' || /\.pdf$/i.test(d.dateiname);
}

/**
 * Muss diese Datei (noch) auf Dokumentgrenzen geprüft werden? Nein bei Teilen,
 * Nicht-PDFs, bereits als „ein Dokument" beurteilten oder manuell entschiedenen
 * Dateien. „unsicher"/„nicht_moeglich" wird bei erneuter Auswertung wieder versucht.
 */
export function brauchtGrenzpruefung(d: PosteingangDatei): boolean {
  if (!istPdf(d) || d.teilVon) return false;
  if (!d.trennung) return true;
  if (d.trennung.manuell) return false;
  return d.trennung.status !== 'ein_dokument';
}

/**
 * Seitenstarts → Seitenbereiche. `[1, 4, 7]` bei 9 Seiten ⇒ 1–3, 4–6, 7–9.
 * Die 1 wird ergänzt, Dubletten entfernt. Wirft bei ungültigen Angaben
 * (mit deutscher Meldung für die Oberfläche).
 */
export function bereicheAusStartSeiten(seitenGesamt: number, startSeiten: number[]): SeitenBereich[] {
  if (!Number.isInteger(seitenGesamt) || seitenGesamt < 1) throw new Error('Seitenzahl der Datei unbekannt');
  const starts = [...new Set([1, ...startSeiten])].sort((a, b) => a - b);
  for (const s of starts) {
    if (!Number.isInteger(s) || s < 1 || s > seitenGesamt) {
      throw new Error(`Ungültige Seitenangabe ${s} — die Datei hat ${seitenGesamt} Seite(n)`);
    }
  }
  return starts.map((from, i) => ({ from, to: i + 1 < starts.length ? starts[i + 1]! - 1 : seitenGesamt }));
}

/** Seitenbereiche → Seitenstarts (Umkehrung, für die Vorbelegung des Korrektur-Formulars). */
export function startSeitenAusBereichen(bereiche: SeitenBereich[]): number[] {
  return bereiche.map((b) => b.from);
}

/** Dateiname eines Teils, z. B. „scan_teil-2_S3-5.pdf". */
export function teilDateiname(original: string, teilNr: number, bereich: SeitenBereich): string {
  const base = original.replace(/\.pdf$/i, '').replace(/[^\w.\- ]+/g, '_').trim() || 'dokument';
  const seiten = bereich.from === bereich.to ? `S${bereich.from}` : `S${bereich.from}-${bereich.to}`;
  return `${base}_teil-${teilNr}_${seiten}.pdf`;
}

/** Original-Beschreibung einer Datei (für `teilVon`). */
export function originalBeschreibung(d: PosteingangDatei, seitenGesamt: number): Omit<PosteingangTeilVon, 'seiteVon' | 'seiteBis' | 'teilNr' | 'teileGesamt' | 'manuell'> {
  return {
    dateiname: d.dateiname, s3Key: d.s3Key, pfad: d.pfad, hash: d.hash,
    contentType: d.contentType, groesse: d.groesse, seitenGesamt,
  };
}

/** Stellt aus einem Teil die ursprüngliche (ungetrennte, nicht ausgewertete) Datei wieder her. */
export function originalAusTeil(teil: PosteingangDatei, trennung?: PosteingangTrennung): PosteingangDatei {
  const o = teil.teilVon!;
  return {
    dateiname: o.dateiname, s3Key: o.s3Key, pfad: o.pfad, contentType: o.contentType,
    groesse: o.groesse, hash: o.hash, ...(trennung ? { trennung } : {}),
  };
}

/** Hash des Originals, zu dem eine Datei gehört (Teil → Original, sonst eigener Hash). */
export function originalHash(d: PosteingangDatei): string {
  return d.teilVon?.hash ?? d.hash;
}

/**
 * Findet die Original-Datei zu `hash`: entweder eine ungetrennte Datei mit diesem
 * Hash oder die aus einem Teil rekonstruierte. Liefert zusätzlich die bekannte
 * Seitenzahl und die aktuellen Seitenbereiche.
 */
export function findeOriginal(dateien: PosteingangDatei[], hash: string): {
  original: PosteingangDatei; seitenGesamt?: number; bereiche: SeitenBereich[];
} | null {
  const teile = dateien.filter((d) => d.teilVon?.hash === hash);
  if (teile.length) {
    const t0 = teile[0]!;
    return {
      original: originalAusTeil(t0),
      seitenGesamt: t0.teilVon!.seitenGesamt,
      bereiche: teile.map((t) => ({ from: t.teilVon!.seiteVon, to: t.teilVon!.seiteBis })).sort((a, b) => a.from - b.from),
    };
  }
  const ganz = dateien.find((d) => !d.teilVon && d.hash === hash);
  if (!ganz) return null;
  const seiten = ganz.trennung?.seitenGesamt;
  return { original: ganz, seitenGesamt: seiten, bereiche: seiten ? [{ from: 1, to: seiten }] : [] };
}

/**
 * Ersetzt alle Einträge, die zum Original `hash` gehören (Teile oder die
 * ungetrennte Datei), an der Position des ersten Treffers durch `neue`.
 */
export function ersetzeGruppe(dateien: PosteingangDatei[], hash: string, neue: PosteingangDatei[]): PosteingangDatei[] {
  const out: PosteingangDatei[] = [];
  let eingefuegt = false;
  for (const d of dateien) {
    if (originalHash(d) !== hash) { out.push(d); continue; }
    if (!eingefuegt) { out.push(...neue); eingefuegt = true; }
  }
  return out;
}

/** Alle Speicher-Refs eines Umschlags (Teile + Originale), dedupliziert — fürs Löschen. */
export function alleSpeicherRefs(dateien: PosteingangDatei[]): Array<{ s3Key?: string; pfad?: string }> {
  const seen = new Set<string>();
  const out: Array<{ s3Key?: string; pfad?: string }> = [];
  const add = (r: { s3Key?: string; pfad?: string }) => {
    const key = r.s3Key ? `s3:${r.s3Key}` : r.pfad ? `local:${r.pfad}` : '';
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ s3Key: r.s3Key, pfad: r.pfad });
  };
  for (const d of dateien) {
    add(d);
    if (d.teilVon) add(d.teilVon);
  }
  return out;
}

// ── IO ───────────────────────────────────────────────────────────────────────

/** Injizierbare Abhängigkeiten (Tests ersetzen Vision-Urteil/Speicher). */
export interface SplitDeps {
  load: (ref: { s3Key?: string; pfad?: string }) => Promise<Uint8Array | null>;
  store: (bytes: Uint8Array, filename: string, contentType: string) => Promise<{ s3Key?: string; pfad?: string; dateiname: string }>;
  countPages: (bytes: Uint8Array) => Promise<number>;
  renderPages: (bytes: Uint8Array) => Promise<PdfPageImage[]>;
  judge: (pages: PdfPageImage[], userId?: string) => Promise<Array<boolean | null>>;
  splitterAvailable: () => Promise<boolean>;
  buildPart: (pdfPath: string, from: number, to: number) => Promise<Uint8Array>;
}

export const defaultSplitDeps: SplitDeps = {
  load: (ref) => loadDokumentDatei(ref),
  store: async (bytes, filename, contentType) => {
    const stored = await storeUpload(bytes, filename, contentType);
    return { ...resolveStorageRef(stored.storageRef), dateiname: stored.filename };
  },
  countPages: (bytes) => countPdfPages(Buffer.from(bytes)),
  renderPages: (bytes) => renderPdfToImages(Buffer.from(bytes), { dpi: 150 }),
  judge: (pages, userId) => judgeBoundaries(pages, userId),
  splitterAvailable: () => isPdfSplitterAvailable(),
  buildPart: async (pdfPath, from, to) => new Uint8Array(await buildPartPdf(pdfPath, from, to)),
};

/** Ergebnis einer Grenzprüfung / Trennung. */
export interface TrennErgebnis {
  dateien: PosteingangDatei[];   // Ersatz für die geprüfte Datei (1 = ungetrennt)
  getrennt: boolean;
  bereiche?: SeitenBereich[];
  hinweis?: string;
  modell?: string;
}

/** Baut die Teil-Dateien (Bytes speichern, Provenienz setzen). */
export async function baueTeile(
  original: PosteingangDatei, bytes: Uint8Array, seitenGesamt: number,
  bereiche: SeitenBereich[], manuell: boolean, deps: SplitDeps,
): Promise<PosteingangDatei[]> {
  const dir = await mkdtemp(join(tmpdir(), 'wohngeld-split-'));
  try {
    const src = join(dir, 'src.pdf');
    await writeFile(src, bytes);
    const basis = originalBeschreibung(original, seitenGesamt);
    const teile: PosteingangDatei[] = [];
    for (let i = 0; i < bereiche.length; i += 1) {
      const b = bereiche[i]!;
      const teilBytes = await deps.buildPart(src, b.from, b.to);
      const name = teilDateiname(original.dateiname, i + 1, b);
      const stored = await deps.store(teilBytes, name, 'application/pdf');
      teile.push({
        dateiname: stored.dateiname || name,
        s3Key: stored.s3Key,
        pfad: stored.pfad,
        contentType: 'application/pdf',
        groesse: teilBytes.length,
        hash: sha256Hex(teilBytes),
        teilVon: { ...basis, seiteVon: b.from, seiteBis: b.to, teilNr: i + 1, teileGesamt: bereiche.length, ...(manuell ? { manuell: true } : {}) },
      });
    }
    return teile;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function mitTrennung(d: PosteingangDatei, trennung: PosteingangTrennung): PosteingangDatei {
  return { ...d, trennung };
}

/**
 * Automatische Grenzprüfung einer (ungetrennten) PDF. Konservativ: trennt nur bei
 * vollständig sicheren Urteilen; sonst bleibt die Datei ein Dokument mit Hinweis.
 */
export async function pruefeUndTrenne(
  datei: PosteingangDatei, opts: { userId?: string } = {}, deps: SplitDeps = defaultSplitDeps,
): Promise<TrennErgebnis> {
  if (!brauchtGrenzpruefung(datei)) return { dateien: [datei], getrennt: false };

  const bytes = await deps.load({ s3Key: datei.s3Key, pfad: datei.pfad });
  if (!bytes) return { dateien: [datei], getrennt: false };

  let seiten = 0;
  try { seiten = await deps.countPages(bytes); } catch { /* unten */ }
  if (!seiten) {
    const hinweis = 'PDF konnte nicht gelesen werden — nicht auf mehrere Dokumente geprüft.';
    return { dateien: [mitTrennung(datei, { status: 'nicht_moeglich', hinweis })], getrennt: false, hinweis };
  }
  if (seiten === 1) {
    return { dateien: [mitTrennung(datei, { status: 'ein_dokument', seitenGesamt: 1 })], getrennt: false };
  }
  const max = splitMaxSeiten();
  if (seiten > max) {
    const hinweis = `${seiten} Seiten — automatische Trennung nur bis ${max} Seiten. Bei Bedarf manuell trennen.`;
    return { dateien: [mitTrennung(datei, { status: 'nicht_moeglich', seitenGesamt: seiten, hinweis })], getrennt: false, hinweis };
  }
  if (!(await deps.splitterAvailable())) {
    const hinweis = 'PDF-Werkzeug zum Trennen ist auf dem Server nicht verfügbar — als ein Dokument behandelt.';
    return { dateien: [mitTrennung(datei, { status: 'nicht_moeglich', seitenGesamt: seiten, hinweis })], getrennt: false, hinweis };
  }

  let urteile: Array<boolean | null>;
  try {
    const pages = await deps.renderPages(bytes);
    urteile = await deps.judge(pages, opts.userId);
  } catch (err) {
    console.warn('[wohngeld] Grenzprüfung fehlgeschlagen:', err instanceof Error ? err.message : err);
    urteile = [null];
  }
  const modell = extractionModelLabel();
  if (urteile.length !== seiten - 1 || urteile.some((u) => u === null)) {
    const hinweis = 'Dokumentgrenzen konnten nicht sicher geprüft werden — als ein Dokument behandelt. Bitte bei Bedarf manuell trennen oder neu auswerten.';
    return { dateien: [mitTrennung(datei, { status: 'unsicher', seitenGesamt: seiten, hinweis })], getrennt: false, hinweis, modell };
  }

  const bereiche = rangesFromBoundaries(seiten, urteile);
  if (bereiche.length <= 1) {
    return { dateien: [mitTrennung(datei, { status: 'ein_dokument', seitenGesamt: seiten })], getrennt: false, bereiche, modell };
  }
  const teile = await baueTeile(datei, bytes, seiten, bereiche, false, deps);
  return { dateien: teile, getrennt: true, bereiche, modell };
}

/**
 * Manuelle Trennung/Zusammenführung durch die Fachkraft. `startSeiten` leer oder
 * nur [1] ⇒ als ein Dokument (Original wiederherstellen, manuell markiert).
 */
export async function trenneManuell(
  original: PosteingangDatei, startSeiten: number[], deps: SplitDeps = defaultSplitDeps,
): Promise<TrennErgebnis & { seitenGesamt: number }> {
  const bytes = await deps.load({ s3Key: original.s3Key, pfad: original.pfad });
  if (!bytes) throw new Error('Originaldatei nicht auffindbar');
  const seiten = await deps.countPages(bytes).catch(() => 0);
  if (!seiten) throw new Error('PDF konnte nicht gelesen werden');

  const bereiche = bereicheAusStartSeiten(seiten, startSeiten);
  const basis: PosteingangDatei = {
    dateiname: original.dateiname, s3Key: original.s3Key, pfad: original.pfad,
    contentType: original.contentType, groesse: original.groesse, hash: original.hash,
  };
  if (bereiche.length === 1) {
    return {
      dateien: [{ ...basis, trennung: { status: 'ein_dokument', seitenGesamt: seiten, manuell: true } }],
      getrennt: false, bereiche, seitenGesamt: seiten,
    };
  }
  if (!(await deps.splitterAvailable())) throw new Error('PDF-Werkzeug zum Trennen ist auf dem Server nicht verfügbar');
  const teile = await baueTeile(basis, bytes, seiten, bereiche, true, deps);
  return { dateien: teile, getrennt: true, bereiche, seitenGesamt: seiten };
}
