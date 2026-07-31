/**
 * Baustein a — RGA-Analyzer-Orchestrierung:
 *   Upload EMMA-Export(e) → pdftotext → deterministischer Checker (PM-01..10)
 *   → LLM-Vor-Benotung D1-D10+D6b (Entwurf!) → Baustand (status 'entwurf').
 *
 * Trennung deterministisch/LLM: Prüfmuster + Kennzahlen-Mathematik sind Code;
 * das LLM liefert NUR die Level-Einordnung + Belegtexte. Kein Baustand gilt
 * ohne Mensch-Review (Freigabe-Gate in den Routen).
 */
import { llmService, type Message } from '../../services/llm';
import { putObject, isS3Configured } from '../../storage/s3';
import { s3Paths } from '../../storage/paths';
import { pdfToText } from './extract';
import { runChecker, deriveHints, parseFamily, type CheckerHints } from './checker';
import type { PMFinding } from './checker/types';
import { computeScores, ALL_DIMS, DIM_LABEL, type Dim } from './scoring';
import { createArtefakt, createBaustand } from './storage';
import type { Baustand, DimensionBewertung } from './types';

export interface UploadFile {
  filename: string;
  bytes: Uint8Array;
  mimeType?: string;
}

/**
 * Modell-Wahl je Aufgabe (Adacor Qwen 3.5, per ENV überschreibbar):
 *  - instruct → strukturierte Vor-Benotung (JSON): die „Denkarbeit" leisten die
 *    deterministischen Checker-Hinweise; Instruct ist dafür schneller + sauberer.
 *  - reason   → für spätere Analyse-Synthese (kundenfähiges Narrativ) reserviert.
 */
const QWEN35 = {
  instruct: {
    providerId: process.env.ECHOLOOP_LLM_PROVIDER || 'adacor',
    modelId: process.env.ECHOLOOP_LLM_MODEL || 'qwen3-5-a3b-35b-256k',
  },
  reason: {
    providerId: process.env.ECHOLOOP_LLM_PROVIDER || 'adacor',
    modelId: process.env.ECHOLOOP_LLM_MODEL_REASON || 'qwen3-5-a3b-35bthinking-256k',
  },
} as const;

/** Fortschritts-Callback: meldet Analyse-Phasen an die SSE-Route. */
export type ProgressFn = (type: string, data: Record<string, unknown>) => void | Promise<void>;

/** Kompaktes L0-L5-Raster je Dimension als LLM-Kontext (WB44, öffentliche Fassung). */
const DIM_RUBRIK = `Reifegrad-Dimensionen (Level L0 niedrig … L5 hoch):
D1 Wahrnehmung/Anker: Pixel/Koordinaten(L0) → Bild → Objekt → Text/RegEx+Filter(L3) → Locator-Repo → selbst-neubindend
D2 Timing/Sync: festes Warten(L0) → großzügige Sleeps → Loop+Find "geladen" → Signal auf Erscheinen/Verschwinden(L3) → zustandsbasiert → adaptiv
D3 Fehler/Ausgänge: Absturz bei Sonderfall(L0) → expliziter Fehler-Ausgang → Status+Excel+nächster Fall → Dialog-Katalog → generischer Handler(nie blind) → lernend
D4 Selbstheilung/Wiederanlauf: keine(L0) → manuell idempotent neustartbar → Recovery bei Start → aktive Selbstreparatur → autonomer Rollback → Selbstdiagnose
D5 Idempotenz/Konsistenz: kann doppelt anlegen(L0) → Overwrite → "erledigt"-Marker → Marker schützt mehrere Senken → atomar → beweisbar re-entrant
D6 Konfiguration: hardcodiert(L0) → einzelne Variablen → CONFIG-Excel → CONFIG-Provider+Label → Spalte je Umgebung → selbst-konfigurierend
D6b Datenfluss: deklarierte Übergabe (Ausgehend↔Eingehend), keine Slot-Recycling, Literal-vs-Variable sauber, Variablen-Fluss-Audit
D7 Messung/Beobachtbarkeit: keine(L0) → Marker+Screenshot → Status je Fall → Zähler+Stabilitätsrate(L3) → KPI-Trend → selbst-bewertend+Alarm
D8 Sicherheit/Compliance: Klartext-PW/PII(L0) → Passwort-Variable → Tresor → Secrets-je-Umgebung+PII → least-privilege+Audit → compliance-by-design
D9 Modularität: Monolith/Copy-Paste(L0) → Master/Sub → CONFIG-Provider → wiederverwendbare Module → ALL-vs-mandantenspezifisch getrennt → Baustein-Bibliothek
D10 Portabilität: umgebungs-fest(L0) → variable Pfade → Config/Secrets extern → Objekt-Repo+neubindbar → Gate P(fremdes System) → selbst-installierend`;

interface LlmGrade {
  levels: Partial<Record<Dim, number>>;
  begruendung: Partial<Record<Dim, string>>;
}

/** LLM-Vor-Benotung: Text + Checker-Befunde → Levels + Begründungen (Entwurf). */
async function llmVorBenotung(
  prozessText: string,
  findings: PMFinding[],
  hints: CheckerHints,
  userId?: string,
): Promise<LlmGrade | null> {
  const befundKurz = findings
    .filter((f) => f.schwere !== 'niedrig')
    .slice(0, 30)
    .map((f) => `- ${f.pm} [${f.schwere}] P${f.prozessNr}${f.schrittId != null ? ` S${f.schrittId}` : ''}: ${f.befund}`)
    .join('\n');
  const hintText = (Object.keys(hints.dims) as (keyof typeof hints.dims)[])
    .map((d) => `- ${String(d).toUpperCase()}: Vorschlag L${hints.dims[d]!.suggest} — ${hints.dims[d]!.evidence.join(' ')}`)
    .join('\n');

  const system: Message = {
    role: 'system',
    content: `Du bist Reifegrad-Analyst für EMMA-Studio-RPA-Prozesse (Echo-Loop-Methode).
Ordne jeder Dimension D1-D10 und D6b ein Ist-Level 0-5 zu, basierend auf dem Prozess-Export-Text und den deterministischen Checker-Befunden.
${DIM_RUBRIK}

Regeln:
- Antworte AUSSCHLIESSLICH mit JSON in genau diesem Format:
  {"levels":{"d1":<0-5>,...,"d10":<0-5>,"d6b":<0-5>},"begruendung":{"d1":"<1 Satz mit Beleg>",...}}
- Jede Begründung nennt einen konkreten Anker aus dem Text/Befund (kein Allgemeinplatz).
- Nutze die deterministischen Level-Vorschläge als Ausgangspunkt; weiche nur mit klarem Textbeleg davon ab.
- Im Zweifel konservativ (niedrigeres Level). Die Zahlen sind ein ENTWURF — ein Mensch prüft jede Benotung.
- Rechne KEINE Kennzahlen (RG/RGQ/SE) — nur die Levels.`,
  };
  const user: Message = {
    role: 'user',
    content: `## Deterministische Level-Vorschläge (Checker — Ausgangspunkt)\n${hintText}\n\n## Deterministische Checker-Befunde\n${befundKurz || '(keine auffälligen Befunde)'}\n\n## Prozess-Export (gekürzt)\n${prozessText.slice(0, 14000)}`,
  };

  try {
    const TIMEOUT_MS = Number(process.env.ECHOLOOP_LLM_TIMEOUT_MS) || 90_000;
    const res = await Promise.race([
      llmService.chat([system, user], undefined, {
        source: 'document_analysis',
        operation: 'echoloop_rga',
        triggeringUserId: userId,
        userId,
      }, {
        modelOverride: QWEN35.instruct, // strukturierte Vor-Benotung → Instruct
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`LLM-Timeout nach ${TIMEOUT_MS}ms`)), TIMEOUT_MS)),
    ]);
    const content = res.content ?? '';
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as LlmGrade;
    if (!parsed || typeof parsed !== 'object' || !parsed.levels) return null;
    return parsed;
  } catch (err) {
    console.warn('[echoloop] LLM-Vor-Benotung fehlgeschlagen:', err instanceof Error ? err.message : err);
    return null;
  }
}

function clamp(v: unknown): number {
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(5, Math.round(n)));
}

/**
 * Führt die komplette Analyse aus und legt einen Baustand-Entwurf an.
 */
export async function analyseProzess(opts: {
  prozessId: string;
  files: UploadFile[];
  userId?: string;
  onProgress?: ProgressFn;
}): Promise<Baustand> {
  const { prozessId, files, userId, onProgress } = opts;
  if (!files.length) throw new Error('Keine Datei hochgeladen');
  const emit = async (phase: string, data: Record<string, unknown> = {}) => { await onProgress?.('progress', { phase, ...data }); };

  // 1. Extraktion + Artefakt-Ablage (S3 optional)
  const extracted: { name: string; text: string }[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    await emit('extract', { file: f.filename, index: i + 1, total: files.length });
    const text = await pdfToText(f.bytes);
    extracted.push({ name: f.filename, text });

    let s3Key = '';
    const artefaktSeg = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    if (isS3Configured()) {
      const safeName = f.filename.replace(/[^a-zA-Z0-9_.\- ]/g, '_').slice(0, 200);
      try {
        s3Key = s3Paths.echoloopExport(prozessId, artefaktSeg, safeName);
        await putObject(s3Key, f.bytes, f.mimeType ?? 'application/pdf');
      } catch (err) {
        console.warn('[echoloop] S3-Upload fehlgeschlagen, fahre ohne fort:', err instanceof Error ? err.message : err);
        s3Key = '';
      }
    }
    await createArtefakt({
      prozessId, filename: f.filename, mimeType: f.mimeType, s3Key: s3Key || `local-unavailable:${artefaktSeg}`,
      data: { extractedText: text.slice(0, 200000) },
    });
  }

  // 2. Deterministischer Checker + Level-Hinweise über die Prozess-Familie
  await emit('checker');
  const checker = runChecker(extracted);
  const hints = deriveHints(parseFamily(extracted));
  await emit('checker_done', { prozesse: checker.family.prozessNummern.length, befunde: checker.findings.length });

  // 3. LLM-Vor-Benotung (Entwurf; Fallback = deterministische Hinweise als Boden, NICHT „alles 0")
  await emit('llm', { status: 'start' });
  const kombinierterText = extracted.map((e) => `### ${e.name}\n${e.text}`).join('\n\n');
  const grade = await llmVorBenotung(kombinierterText, checker.findings, hints, userId);
  await emit('llm_done', { status: grade ? 'done' : 'fallback' });

  // 4. Dimensionen aufbauen: Ist = LLM-Level (falls da) sonst Checker-Vorschlag;
  //    Beleg = deterministische Checker-Evidenz; Soll default = Ist (Analyst setzt echtes Soll im Review).
  const dimensionen = {} as Record<Dim, DimensionBewertung>;
  const llmBegruendung: Partial<Record<Dim, string>> = {};
  for (const d of ALL_DIMS) {
    const hint = hints.dims[d];
    const ist = grade ? clamp(grade.levels[d]) : (hint?.suggest ?? 0);
    dimensionen[d] = {
      ist,
      soll: ist,
      relevanz: 1,
      beleg: hint?.evidence?.join(' · '),
      provenienz: hint?.evidence?.length ? '[G Text]' : undefined,
      konfidenz: grade ? 'weich' : 'offen',
    };
    if (grade?.begruendung?.[d]) llmBegruendung[d] = grade.begruendung[d];
  }

  // 5. Kennzahlen deterministisch
  const s = computeScores(dimensionen);
  const kennzahlen = { gesamtRg: s.gesamtRg, rgStar: s.rgStar, rgq: s.rgq, seQuotient: s.seQuotient, limiter: s.limiter, notenZeile: s.notenZeile };

  // 6. Baustand-Entwurf anlegen (Mensch-Review-Gate: status 'entwurf')
  await emit('persist');
  const quelle = `Upload ${files[0]!.filename}${files.length > 1 ? ` (+${files.length - 1})` : ''}`;
  const baustand = await createBaustand({
    prozessId,
    datum: new Date().toISOString().slice(0, 10),
    status: 'entwurf',
    quelle,
    dimensionen,
    befunde: checker.findings,
    kennzahlen,
    llmBegruendung,
    topHebel: hints.topHebel,
  });

  return baustand;
}
