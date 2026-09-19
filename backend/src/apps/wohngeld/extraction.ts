/**
 * Wohngeld — Klassifikation & Extraktion (Phase 4).
 *
 * Trennung: `parseExtraktion` ist rein/testbar (LLM-JSON → typisiertes Ergebnis,
 * robust gegen Fließtext, kaputtes JSON und unbekannte Typen). `klassifiziere-
 * UndExtrahiere` baut den Prompt, ruft den llmService (Timeout-Race wie echoloop)
 * und reicht die Antwort an `parseExtraktion` durch.
 *
 * Der Daten-Contract (Feldnamen in `analyse` + `typ`-Enum) MUSS exakt zu types.ts
 * passen — die Regel-Engine (checker/) konsumiert genau diese Felder.
 */
import { llmService, type Message } from '../../services/llm';
import { wohngeldUsageMetadata } from './ki-governance';
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

/** Ergebnis von Klassifikation + Extraktion eines einzelnen Dokuments. */
export interface ExtraktionErgebnis {
  typ: DokumentTyp;
  titel?: string;
  analyse: DokumentAnalyse;
  stammdaten?: ExtrahierteStammdaten;
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

function pickAnalyse(raw: unknown): DokumentAnalyse {
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

function pickStammdaten(raw: unknown): ExtrahierteStammdaten | undefined {
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
 * Robustes Parsen der LLM-Antwort. Toleriert Fließtext um das JSON, kaputtes JSON
 * (→ Fallback) und unbekannte `typ`-Werte (→ 'sonstiges'). Nie werfend.
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

  const ergebnis: ExtraktionErgebnis = { typ, analyse: pickAnalyse(parsed.analyse) };
  const titel = asString(parsed.titel);
  if (titel) ergebnis.titel = titel;
  const stammdaten = pickStammdaten(parsed.stammdaten);
  if (stammdaten) ergebnis.stammdaten = stammdaten;
  return ergebnis;
}

// ── LLM-Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Du bist ein Assistent zur Klassifikation und Datenextraktion von Unterlagen in einem deutschen Wohngeldverfahren.
Analysiere den Text EINES eingescannten Dokuments und antworte AUSSCHLIESSLICH mit JSON — kein Fließtext, keine Erklärung, keine Markdown-Codefences.

Erlaubte Werte für "typ" (genau einer):
wohngeldantrag | personalausweis | mietvertrag | mietbescheinigung | rentenbescheid | verdienstbescheinigung | gehaltsabrechnung | kontoauszug | kv_pv_nachweis | schwerbehindertenausweis | pflegenachweis | kindergeldnachweis | unterhaltsnachweis | transferleistungsbescheid | vermoegensnachweis | sonstiges

Antworte in genau diesem Schema (nur zutreffende Felder setzen, unbekannte Felder weglassen):
{
  "typ": "<einer der erlaubten Werte>",
  "titel": "<kurzer sprechender Titel des Dokuments>",
  "analyse": {
    "miete": <Bruttokaltmiete in EUR als Zahl, z.B. aus Mietvertrag/Mietbescheinigung>,
    "wohnflaeche_qm": <Wohnfläche in m² als Zahl>,
    "unterschrift_vorhanden": <true|false — ist das Dokument unterschrieben?>,
    "datum_vorhanden": <true|false — trägt das Dokument ein Datum?>,
    "rentenart_vorhanden": <true|false — nennt ein Rentenbescheid die Rentenart?>,
    "grundrentenzeiten_vorhanden": <true|false — sind Grundrentenzeiten ausgewiesen?>,
    "mietzahlung_erkannt": <true|false — zeigt ein Kontoauszug eine Mietabbuchung?>,
    "erkannte_einkuenfte": ["<z.B. kapitalertraege, lohn_gehalt, rente>"],
    "betrag": <generischer Betrag in EUR, z.B. Renten-/Gehaltshöhe>
  },
  "stammdaten": {
    "antragsdatum": "<ISO-Datum JJJJ-MM-TT>",
    "wohngeldart": "mietzuschuss|lastenzuschuss",
    "antragsart": "erstantrag|weiterleistungsantrag|erhoehungsantrag|aenderungsantrag",
    "antragsteller": { "vorname": "", "nachname": "", "geburtsdatum": "<ISO>" },
    "adresse": { "strasse": "", "hausnummer": "", "plz": "", "ort": "" },
    "wohnung": { "miete": <Zahl>, "wohnflaeche_qm": <Zahl> }
  }
}

Regeln:
- "stammdaten" NUR ausfüllen, wenn "typ" = "wohngeldantrag" ist. Für alle anderen Typen "stammdaten" weglassen.
- Zahlen als reine Zahlen (Punkt als Dezimaltrenner), nicht als Text mit Einheit.
- Ist ein Wert nicht sicher erkennbar, das Feld weglassen (nicht raten). Im Zweifel "typ": "sonstiges".`;

/**
 * Klassifiziert + extrahiert ein Dokument aus seinem Text. Graceful:
 * leerer Text oder LLM-Fehler/Timeout → neutrales Fallback-Ergebnis.
 */
export async function klassifiziereUndExtrahiere(
  text: string,
  opts: { userId?: string; filename?: string; vorgangId?: string } = {},
): Promise<ExtraktionErgebnis> {
  const trimmed = (text || '').trim();
  if (!trimmed) return fallbackErgebnis();

  const user: Message = {
    role: 'user',
    content: `Dateiname: ${opts.filename ?? '(unbekannt)'}\n\n## Dokument-Text (gekürzt)\n${trimmed.slice(0, 14000)}`,
  };
  const system: Message = { role: 'system', content: SYSTEM_PROMPT };

  try {
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
  } catch (err) {
    console.warn('[wohngeld] Klassifikation/Extraktion fehlgeschlagen:', err instanceof Error ? err.message : err);
    return fallbackErgebnis();
  }
}
