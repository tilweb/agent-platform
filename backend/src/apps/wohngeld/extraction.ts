/**
 * Wohngeld — Klassifikation & Extraktion (Phase 4).
 *
 * Zweistufig:
 *   1. Klassifikation (wohngeld-eigen, enum-strikt): ein LLM-Call bestimmt nur
 *      `typ` (DokumentTyp) + `titel`. `parseExtraktion` ist rein/testbar und
 *      robust gegen Fließtext, kaputtes JSON und unbekannte Typen.
 *   2. Stammdaten/Analyse (nur bei `wohngeldantrag`): via Plattform-Extraction
 *      `runPipeline` (born-digital → single-pass, Scan/Bild → hybrid mit Vision).
 *      `mapPipelineToErgebnis` bildet das Ergebnis auf die Wohngeld-Typen ab und
 *      liefert Confidence je `feld_status`-Feldpfad.
 *
 * Der Daten-Contract (Feldnamen in `analyse` + `typ`-Enum) MUSS exakt zu types.ts
 * passen — die Regel-Engine (checker/) konsumiert genau diese Felder.
 *
 * Graceful: kein Provider, fehlendes poppler, oder werfende Pipeline → neutrales
 * Fallback-Ergebnis. Der Upload darf niemals crashen.
 */
import { llmService, type Message } from '../../services/llm';
import { runPipeline, type PreparedFile, type StrategyId } from '../../services/extraction';
import { pdfToLayoutText } from '../../services/extraction/pdf';
import { extractionModelOverride } from '../../extraction/model';
import { wohngeldUsageMetadata } from './ki-governance';
import { schemaFuerTyp, mapPipelineToErgebnis, mapPipelineToAnalyse } from './extraction-schema';
import type { DokumentTyp, DokumentAnalyse, Wohngeldart, Antragsart } from './types';

/** Aus dem Wohngeldantrag extrahierte Stammdaten (befüllen Vorgang + Antragsteller). */
export interface ExtrahierteStammdaten {
  antragsdatum?: string;
  wohngeldart?: Wohngeldart;
  antragsart?: Antragsart;
  antragsteller?: {
    vorname?: string;
    nachname?: string;
    geburtsdatum?: string;
  };
  adresse?: {
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
  };
  wohnung?: {
    miete?: number;
    wohnflaeche_qm?: number;
  };
}

/**
 * Leichte Identitäts-Signale eines Dokuments (Grundlage des Zuordnungs-Matchings).
 * Aus dem Antrag: aus `stammdaten.antragsteller` abgeleitet. Aus Nachweisen
 * (Ausweis, Rentenbescheid, Miet-/Kontonachweis): eigene `identitaet`-Feldgruppe.
 * Kein identifizierendes Feld → kein Match-Signal → kein Vorschlag.
 */
export interface Identitaet {
  nachname?: string;
  vorname?: string;
  geburtsdatum?: string;
}

/** Ergebnis von Klassifikation + Extraktion eines einzelnen Dokuments. */
export interface ExtraktionErgebnis {
  typ: DokumentTyp;
  titel?: string;
  analyse: DokumentAnalyse;
  stammdaten?: ExtrahierteStammdaten;
  /** Identitäts-Signal für das Zuordnungs-Matching (Antrag: aus Stammdaten; Nachweis: eigene Extraktion). */
  identitaet?: Identitaet;
  /** Confidence je `feld_status`-Feldpfad (0..1), aus der Extraction-Pipeline. */
  confidenceByPfad?: Record<string, number>;
}

/** Modell-Wahl (Adacor Qwen, per ENV überschreibbar — gleiche Defaults wie echoloop). */
const MODEL = {
  providerId: process.env.WOHNGELD_LLM_PROVIDER || 'adacor',
  modelId: process.env.WOHNGELD_LLM_MODEL || 'qwen3-5-a3b-35b-256k',
} as const;

/** Erlaubte Dokumenttypen (Enum-Wächter für `parseExtraktion`). */
const DOKUMENT_TYPEN: readonly DokumentTyp[] = [
  'wohngeldantrag', 'personalausweis', 'mietvertrag', 'mietbescheinigung',
  'rentenbescheid', 'verdienstbescheinigung', 'gehaltsabrechnung', 'kontoauszug',
  'kv_pv_nachweis', 'schwerbehindertenausweis', 'pflegenachweis', 'kindergeldnachweis',
  'unterhaltsnachweis', 'transferleistungsbescheid', 'vermoegensnachweis', 'sonstiges',
];
const WOHNGELDARTEN: readonly Wohngeldart[] = ['mietzuschuss', 'lastenzuschuss'];
const ANTRAGSARTEN: readonly Antragsart[] = ['erstantrag', 'weiterleistungsantrag', 'erhoehungsantrag', 'aenderungsantrag'];

/** Neutrales Fallback-Ergebnis (leerer Text / kein LLM / Parse-Fehler). */
export function fallbackErgebnis(): ExtraktionErgebnis {
  return { typ: 'sonstiges', analyse: {} };
}

// ── reine Helfer ────────────────────────────────────────────────────────────

function asBool(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    // deutsche Zahlenformate tolerieren: "1.234,56" bzw. "1234,56"
    const norm = v.replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
    const n = Number(norm);
    if (Number.isFinite(n) && norm !== '') return n;
  }
  return undefined;
}

function asString(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim();
  return undefined;
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
  return out.length ? out : undefined;
}

export function pickAnalyse(raw: unknown): DokumentAnalyse {
  const a = (raw ?? {}) as Record<string, unknown>;
  const out: DokumentAnalyse = {};
  const miete = asNumber(a.miete); if (miete !== undefined) out.miete = miete;
  const flaeche = asNumber(a.wohnflaeche_qm); if (flaeche !== undefined) out.wohnflaeche_qm = flaeche;
  const unterschrift = asBool(a.unterschrift_vorhanden); if (unterschrift !== undefined) out.unterschrift_vorhanden = unterschrift;
  const datum = asBool(a.datum_vorhanden); if (datum !== undefined) out.datum_vorhanden = datum;
  const rentenart = asBool(a.rentenart_vorhanden); if (rentenart !== undefined) out.rentenart_vorhanden = rentenart;
  const grundrente = asBool(a.grundrentenzeiten_vorhanden); if (grundrente !== undefined) out.grundrentenzeiten_vorhanden = grundrente;
  const mietzahlung = asBool(a.mietzahlung_erkannt); if (mietzahlung !== undefined) out.mietzahlung_erkannt = mietzahlung;
  const einkuenfte = asStringArray(a.erkannte_einkuenfte); if (einkuenfte !== undefined) out.erkannte_einkuenfte = einkuenfte;
  const betrag = asNumber(a.betrag); if (betrag !== undefined) out.betrag = betrag;
  return out;
}

export function pickStammdaten(raw: unknown): ExtrahierteStammdaten | undefined {
  const s = (raw ?? {}) as Record<string, unknown>;
  const out: ExtrahierteStammdaten = {};

  const antragsdatum = asString(s.antragsdatum); if (antragsdatum) out.antragsdatum = antragsdatum;
  const wga = asString(s.wohngeldart); if (wga && WOHNGELDARTEN.includes(wga as Wohngeldart)) out.wohngeldart = wga as Wohngeldart;
  const ana = asString(s.antragsart); if (ana && ANTRAGSARTEN.includes(ana as Antragsart)) out.antragsart = ana as Antragsart;

  const at = (s.antragsteller ?? {}) as Record<string, unknown>;
  const antragsteller: NonNullable<ExtrahierteStammdaten['antragsteller']> = {};
  const vorname = asString(at.vorname); if (vorname) antragsteller.vorname = vorname;
  const nachname = asString(at.nachname); if (nachname) antragsteller.nachname = nachname;
  const geburtsdatum = asString(at.geburtsdatum); if (geburtsdatum) antragsteller.geburtsdatum = geburtsdatum;
  if (Object.keys(antragsteller).length) out.antragsteller = antragsteller;

  const ad = (s.adresse ?? {}) as Record<string, unknown>;
  const adresse: NonNullable<ExtrahierteStammdaten['adresse']> = {};
  const strasse = asString(ad.strasse); if (strasse) adresse.strasse = strasse;
  const hausnummer = asString(ad.hausnummer); if (hausnummer) adresse.hausnummer = hausnummer;
  const plz = asString(ad.plz); if (plz) adresse.plz = plz;
  const ort = asString(ad.ort); if (ort) adresse.ort = ort;
  if (Object.keys(adresse).length) out.adresse = adresse;

  const wh = (s.wohnung ?? {}) as Record<string, unknown>;
  const wohnung: NonNullable<ExtrahierteStammdaten['wohnung']> = {};
  const miete = asNumber(wh.miete); if (miete !== undefined) wohnung.miete = miete;
  const flaeche = asNumber(wh.wohnflaeche_qm); if (flaeche !== undefined) wohnung.wohnflaeche_qm = flaeche;
  if (Object.keys(wohnung).length) out.wohnung = wohnung;

  return Object.keys(out).length ? out : undefined;
}

/**
 * Reiner Guard für das Identitäts-Signal (nachname/vorname/geburtsdatum). Kein
 * identifizierendes Feld → `undefined` (dann kein Match-Signal → kein Vorschlag).
 */
export function pickIdentitaet(raw: unknown): Identitaet | undefined {
  const s = (raw ?? {}) as Record<string, unknown>;
  const out: Identitaet = {};
  const nachname = asString(s.nachname); if (nachname) out.nachname = nachname;
  const vorname = asString(s.vorname); if (vorname) out.vorname = vorname;
  const geburtsdatum = asString(s.geburtsdatum); if (geburtsdatum) out.geburtsdatum = geburtsdatum;
  return Object.keys(out).length ? out : undefined;
}

/**
 * Robustes Parsen der Klassifikator-Antwort — nur noch `typ` + `titel`.
 * Toleriert Fließtext um das JSON, kaputtes JSON (→ Fallback) und unbekannte
 * `typ`-Werte (→ 'sonstiges'). Nie werfend. Stammdaten/Analyse liefert nicht
 * mehr der Klassifikator, sondern die Extraction-Pipeline (siehe
 * `klassifiziereUndExtrahiere`); `analyse` bleibt hier daher leer.
 */
export function parseExtraktion(jsonRaw: string): ExtraktionErgebnis {
  if (!jsonRaw || typeof jsonRaw !== 'string') return fallbackErgebnis();
  const match = jsonRaw.match(/\{[\s\S]*\}/);
  if (!match) return fallbackErgebnis();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return fallbackErgebnis();
  }
  if (!parsed || typeof parsed !== 'object') return fallbackErgebnis();

  const rawTyp = asString(parsed.typ);
  const typ: DokumentTyp = rawTyp && DOKUMENT_TYPEN.includes(rawTyp as DokumentTyp)
    ? (rawTyp as DokumentTyp)
    : 'sonstiges';

  const ergebnis: ExtraktionErgebnis = { typ, analyse: {} };
  const titel = asString(parsed.titel);
  if (titel) ergebnis.titel = titel;
  return ergebnis;
}

// ── LLM-Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Du bist ein Assistent zur Klassifikation von Unterlagen in einem deutschen Wohngeldverfahren.
Analysiere den Text EINES Dokuments und antworte AUSSCHLIESSLICH mit JSON — kein Fließtext, keine Erklärung, keine Markdown-Codefences.

Erlaubte Werte für "typ" (genau einer):
wohngeldantrag | personalausweis | mietvertrag | mietbescheinigung | rentenbescheid | verdienstbescheinigung | gehaltsabrechnung | kontoauszug | kv_pv_nachweis | schwerbehindertenausweis | pflegenachweis | kindergeldnachweis | unterhaltsnachweis | transferleistungsbescheid | vermoegensnachweis | sonstiges

Antworte in genau diesem Schema:
{
  "typ": "<einer der erlaubten Werte>",
  "titel": "<kurzer sprechender Titel des Dokuments>"
}

Regeln:
- Bestimme ausschließlich den Dokumenttyp und einen kurzen Titel. Keine weiteren Felder.
- Ist der Typ nicht sicher erkennbar, "typ": "sonstiges".`;

/** Schwelle: unter so viel Text gilt ein PDF als Scan (kein born-digital Text). */
const SCAN_TEXT_THRESHOLD = 20;

/** Gewonnener Text + Scan-Erkennung eines Uploads. */
interface TextGewinnung {
  text: string;
  /** true → Scan/Bild: Vision-Pfad (hybrid + rawBuffer). */
  scanMode: boolean;
}

/**
 * Text gewinnen + Scan-Erkennung (pragmatisch). Born-digital PDF → Layout-Text
 * via Plattform-`pdfToLayoutText`. Bild oder (nahezu) leerer PDF-Text → Scan.
 * Wirft nie — poppler fehlt/PDF kaputt → leerer Text (→ Scan bzw. Fallback).
 */
async function gewinneText(bytes: Uint8Array, mimeType: string): Promise<TextGewinnung> {
  const isImage = (mimeType || '').startsWith('image/');
  if (isImage) return { text: '', scanMode: true };

  let text = '';
  try {
    text = await pdfToLayoutText(Buffer.from(bytes));
  } catch (err) {
    console.warn('[wohngeld] pdfToLayoutText fehlgeschlagen:', err instanceof Error ? err.message : err);
    text = '';
  }
  const scanMode = text.trim().length < SCAN_TEXT_THRESHOLD;
  return { text, scanMode };
}

/**
 * Klassifikator (wohngeld-eigen, enum-strikt): ein LLM-Call → `typ` + `titel`.
 * Nutzt den vorhandenen Text bzw. bei Scans nur den Dateinamen als knappen
 * Kontext. Wirft nicht — Fehler/Timeout werfen (vom Aufrufer gefangen).
 */
async function klassifiziere(
  text: string,
  opts: { userId?: string; filename?: string; vorgangId?: string },
): Promise<ExtraktionErgebnis> {
  const trimmed = (text || '').trim();
  const kontext = trimmed
    ? `## Dokument-Text (gekürzt)\n${trimmed.slice(0, 14000)}`
    : '## Dokument-Text\n(kein maschinenlesbarer Text — evtl. Scan. Bestimme den Typ soweit möglich aus dem Dateinamen.)';

  const user: Message = {
    role: 'user',
    content: `Dateiname: ${opts.filename ?? '(unbekannt)'}\n\n${kontext}`,
  };
  const system: Message = { role: 'system', content: SYSTEM_PROMPT };

  const TIMEOUT_MS = Number(process.env.WOHNGELD_LLM_TIMEOUT_MS) || 90_000;
  const res = await Promise.race([
    llmService.chat([system, user], undefined, {
      source: 'document_analysis',
      operation: 'wohngeld_klassifikation',
      triggeringUserId: opts.userId,
      userId: opts.userId,
      resourceId: opts.vorgangId,
      metadata: wohngeldUsageMetadata({ providerId: MODEL.providerId, modelId: MODEL.modelId, vorgangId: opts.vorgangId }),
    }, {
      modelOverride: MODEL,
    }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`LLM-Timeout nach ${TIMEOUT_MS}ms`)), TIMEOUT_MS)),
  ]);
  return parseExtraktion(res.content ?? '');
}

/**
 * Klassifiziert ein Dokument und extrahiert — nur bei `wohngeldantrag` —
 * Stammdaten + Analyse via Plattform-Extraction-Pipeline.
 *
 * Ablauf:
 *   (a) Text gewinnen + Scan erkennen (`gewinneText`).
 *   (b) Klassifikation (eigener enum-strikter LLM-Call).
 *   (c) `wohngeldantrag` → `runPipeline` (born-digital: single-pass; Scan/Bild:
 *       hybrid mit `rawBuffer`) + Mapping auf Wohngeld-Typen inkl. Confidence.
 *   (d) sonst leere Stammdaten.
 *
 * Graceful: jeder Fehler (kein Provider, poppler fehlt, Pipeline wirft) →
 * neutrales Fallback-Ergebnis. Der Upload bricht nie ab.
 */
export async function klassifiziereUndExtrahiere(
  bytes: Uint8Array,
  mimeType: string,
  opts: { userId?: string; filename?: string; vorgangId?: string } = {},
): Promise<ExtraktionErgebnis> {
  try {
    // (a) Text + Scan-Erkennung
    const { text, scanMode } = await gewinneText(bytes, mimeType);

    // (b) Klassifikation
    const klass = await klassifiziere(text, opts);

    // (c) Schema-gebundene Extraktion via Plattform-Pipeline. Jeder Typ bekommt ein Schema:
    //     Antrag → Stammdaten+Analyse; Fach-Nachweise → Analyse+Identität; alle übrigen Typen
    //     → generische Identitäts-Extraktion (Match-Signal für die Vorgangs-Zuordnung).
    const strategy: StrategyId = scanMode ? 'hybrid' : 'single-pass';
    const schema = schemaFuerTyp(klass.typ, strategy);

    const prepared: PreparedFile = scanMode
      ? { filename: opts.filename ?? 'dokument', text, mimeType: mimeType || 'application/pdf', rawBuffer: Buffer.from(bytes) }
      : { filename: opts.filename ?? 'dokument', text, mimeType: mimeType || 'application/pdf' };

    const result = await runPipeline({
      files: [prepared],
      schema,
      userId: opts.userId ?? '',
      modelOverride: extractionModelOverride(),
    });

    // Wohngeldantrag: Stammdaten + Analyse + Confidence fuer feld_status.
    if (klass.typ === 'wohngeldantrag') {
      const mapped = mapPipelineToErgebnis(result.extracted, result.fieldConfidences);
      const ergebnis: ExtraktionErgebnis = { typ: 'wohngeldantrag', analyse: mapped.analyse };
      if (klass.titel) ergebnis.titel = klass.titel;
      if (Object.keys(mapped.stammdaten).length) ergebnis.stammdaten = mapped.stammdaten;
      if (mapped.identitaet) ergebnis.identitaet = mapped.identitaet;
      if (Object.keys(mapped.confidenceByPfad).length) ergebnis.confidenceByPfad = mapped.confidenceByPfad;
      return ergebnis;
    }

    // Nachweis-Dokumente (mietvertrag/mietbescheinigung/kontoauszug/rentenbescheid):
    // nur Analyse, keine Stammdaten.
    const mappedAnalyse = mapPipelineToAnalyse(klass.typ, result.extracted, result.fieldConfidences);
    const ergebnis: ExtraktionErgebnis = { typ: klass.typ, analyse: mappedAnalyse.analyse };
    if (klass.titel) ergebnis.titel = klass.titel;
    if (mappedAnalyse.identitaet) ergebnis.identitaet = mappedAnalyse.identitaet;
    return ergebnis;
  } catch (err) {
    console.warn('[wohngeld] Klassifikation/Extraktion fehlgeschlagen:', err instanceof Error ? err.message : err);
    return fallbackErgebnis();
  }
}
