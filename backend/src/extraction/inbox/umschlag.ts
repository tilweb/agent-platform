/**
 * Umschlag je Upload (Konzept DP-Produktmodell §3): eine ID, ein Webhook, ein
 * Ergebnis — auch wenn intern mehrere Pipelines laufen. Zugleich die
 * Abrechnungseinheit (Seiten × Produkt).
 *
 * `baueUmschlag` ist rein (testbar); `ladeUmschlag` holt Upload, Teile und die
 * Batch-Ergebnisse; `umschlagNachLauf` wird nach jedem Batch-Lauf aufgerufen und
 * stellt den Webhook genau einmal zu, sobald alle Teile fertig sind.
 */

import type { TokenMessung } from '../../services/llm/token-meter';
import type { VertragsAuswertung, Volltext } from '../../services/extraction/contract/types';
import { abrechnungsPosten, fasseAbrechnungZusammen, PRODUKTE, type AbrechnungsPosten } from '../produkte';
import { istBasisprofil } from '../basisprofil';
import type { BatchFileSummary } from '../learning/batch-runs';
import type { RuleIssue } from '../learning/types';
import { claimUmschlagZustellung, findPartsByRunId, getUpload, updateUpload, type EingangsModus, type InboxPart, type InboxUploadWithParts } from './store';

export type TeilStatus = 'in_arbeit' | 'fertig' | 'zu_pruefen' | 'kein_profil' | 'fehler' | 'nicht_zugeordnet';

export interface UmschlagTeil {
  teil_id: string;
  seiten: string;
  seiten_anzahl: number;
  profil: string | null;
  zuordnung: { sicherheit: number | null; kandidaten: Array<{ profil: string; sicherheit: number }>; vorgegeben: boolean };
  status: TeilStatus;
  ergebnis?: {
    data: Record<string, unknown> | null;
    field_confidences: Record<string, number> | null;
    review_status: string | null;
    validations: RuleIssue[];
    strategy: string | null;
    vertrag?: VertragsAuswertung;
    volltext?: Volltext;
    document_text?: string;
  };
  fehler?: string;
}

export interface Umschlag {
  upload_id: string;
  dateiname: string;
  modus: EingangsModus;
  status: 'verarbeitung' | 'fertig' | 'fehler';
  seiten_gesamt: number | null;
  hinweis?: string;
  fehler?: string;
  teile: UmschlagTeil[];
  abrechnung: AbrechnungsPosten[];
  verbrauch: { aufrufe: number; prompt_tokens: number; completion_tokens: number; ohne_angabe: number };
}

/** Ergebnis je Teil — Batch-Datei-Zusammenfassung plus (optional) Detailfelder. */
export interface TeilErgebnis {
  datei: Pick<BatchFileSummary, 'status' | 'data' | 'fieldConfidences' | 'reviewStatus' | 'validations' | 'strategy' | 'error' | 'audit' | 'documentText'>;
  vertrag?: VertragsAuswertung;
  volltext?: Volltext;
  /** Der ganze Batch-Lauf ist abgebrochen — offene Dateien werden nie fertig. */
  laufAbgebrochen?: boolean;
}

const seitenAnzahl = (t: InboxPart) => Math.max(1, t.pageTo - t.pageFrom + 1);

function teilStatus(t: InboxPart, e: TeilErgebnis | undefined): TeilStatus {
  if (t.status === 'unassigned' || !t.batchRunId) return 'nicht_zugeordnet';
  if (e?.laufAbgebrochen && (e.datei.status === 'pending' || e.datei.status === 'processing')) return 'fehler';
  if (!e || e.datei.status === 'pending' || e.datei.status === 'processing') return 'in_arbeit';
  if (e.datei.status === 'failed') return 'fehler';
  if (t.status === 'kein_profil' || istBasisprofil(t.targetProjectId)) return 'kein_profil';
  return e.datei.reviewStatus === 'needs_review' ? 'zu_pruefen' : 'fertig';
}

/** Umschlag aus Upload, Teilen und Ergebnissen (rein). `ergebnisse` ist nach Teil-ID verschluesselt. */
export function baueUmschlag(upload: InboxUploadWithParts, ergebnisse: Record<string, TeilErgebnis | undefined>): Umschlag {
  const teile: UmschlagTeil[] = upload.parts.map((t) => {
    const e = ergebnisse[t.id];
    const status = teilStatus(t, e);
    const c = t.classification;
    return {
      teil_id: t.id,
      seiten: t.pageFrom === t.pageTo ? String(t.pageFrom) : `${t.pageFrom}–${t.pageTo}`,
      seiten_anzahl: seitenAnzahl(t),
      profil: t.targetProjectId,
      zuordnung: {
        sicherheit: c ? c.confidence : null,
        kandidaten: (c?.alternatives ?? []).map((a) => ({ profil: a.project_id, sicherheit: a.confidence })),
        vorgegeben: !!upload.profilId,
      },
      status,
      ...(e && (e.datei.status === 'completed' || e.datei.status === 'failed') ? {
        ergebnis: {
          data: e.datei.data,
          field_confidences: e.datei.fieldConfidences,
          review_status: e.datei.reviewStatus,
          validations: e.datei.validations ?? [],
          strategy: e.datei.strategy,
          ...(e.vertrag ? { vertrag: e.vertrag } : {}),
          ...(e.volltext ? { volltext: e.volltext } : {}),
          ...(e.datei.documentText ? { document_text: e.datei.documentText } : {}),
        },
      } : {}),
      ...(e?.datei.error ? { fehler: e.datei.error } : status === 'fehler' ? { fehler: 'Verarbeitungslauf abgebrochen' } : {}),
    };
  });

  // Abrechnung: je ausgewertetem Teil Seiten × Produkt der genutzten Strategie (bzw. des Abrechnungspostens der
  // Auswertung); im Stapel-Modus zusaetzlich die Trennung ueber alle Seiten.
  const posten: AbrechnungsPosten[] = [];
  for (const t of upload.parts) {
    const e = ergebnisse[t.id];
    if (!e || e.datei.status !== 'completed') continue;
    const a = e.datei.audit?.abrechnung;
    posten.push(a ? { ...a, seiten: seitenAnzahl(t) } : abrechnungsPosten(e.datei.strategy ?? undefined, seitenAnzahl(t)));
    for (const z of e.datei.audit?.zusatz ?? []) posten.push({ ...z, seiten: seitenAnzahl(t) });
  }
  if (upload.modus === 'stapel' && !upload.profilId && (upload.pageCount ?? 0) > 1) {
    posten.push({ produkt: 'stapel-trennung', seiten: upload.pageCount!, kostenfaktor: PRODUKTE['stapel-trennung'].kostenfaktor });
  }

  const verbrauch = { aufrufe: 0, prompt_tokens: 0, completion_tokens: 0, ohne_angabe: 0 };
  for (const e of Object.values(ergebnisse)) {
    const v: TokenMessung | undefined = e?.datei.audit?.verbrauch;
    if (!v) continue;
    verbrauch.aufrufe += v.aufrufe; verbrauch.prompt_tokens += v.promptTokens; verbrauch.completion_tokens += v.completionTokens; verbrauch.ohne_angabe += v.ohneAngabe;
  }

  const offen = upload.status === 'processing' || teile.some((t) => t.status === 'in_arbeit');
  return {
    upload_id: upload.id,
    dateiname: upload.filename,
    modus: upload.modus,
    status: upload.status === 'failed' ? 'fehler' : offen ? 'verarbeitung' : 'fertig',
    seiten_gesamt: upload.pageCount,
    ...(upload.note ? { hinweis: upload.note } : {}),
    ...(upload.error ? { fehler: upload.error } : {}),
    teile,
    abrechnung: fasseAbrechnungZusammen(posten),
    verbrauch,
  };
}

/** Upload samt Ergebnissen laden. `mitDetail` laedt Vertragsauswertung/Volltext nach (fuer API/Webhook). */
export async function ladeUmschlag(uploadId: string, mitDetail = true): Promise<Umschlag | null> {
  const upload = await getUpload(uploadId);
  if (!upload) return null;
  const { getBatchRun, getBatchRunFileDetail, hatTextDetail } = await import('../learning/batch-runs');
  const ergebnisse: Record<string, TeilErgebnis | undefined> = {};
  const laeufe = new Map<string, Awaited<ReturnType<typeof getBatchRun>>>();
  for (const t of upload.parts) {
    if (!t.batchRunId || !t.targetProjectId) continue;
    const key = `${t.targetProjectId}|${t.batchRunId}`;
    if (!laeufe.has(key)) laeufe.set(key, await getBatchRun(t.targetProjectId, t.batchRunId, { mitText: mitDetail }));
    const lauf = laeufe.get(key);
    const datei = lauf?.files.find((f) => f.filename === t.filename);
    if (!datei) continue;
    const e: TeilErgebnis = { datei, ...(lauf?.run.status === 'failed' ? { laufAbgebrochen: true } : {}) };
    if (mitDetail && datei.status === 'completed' && hatTextDetail(datei)) {
      const d = await getBatchRunFileDetail(t.targetProjectId, t.batchRunId, datei.id);
      if (d?.vertrag) e.vertrag = d.vertrag;
      if (d?.volltext) e.volltext = d.volltext;
    }
    ergebnisse[t.id] = e;
  }
  return baueUmschlag(upload, ergebnisse);
}

/**
 * Abschluss pruefen: Sind alle Teile fertig (oder ist der Upload gescheitert), wird
 * die Abrechnung gespeichert und — falls eine callback_url gesetzt ist — der
 * Umschlag genau einmal zugestellt.
 */
export async function umschlagAbschliessen(uploadId: string): Promise<void> {
  const upload = await getUpload(uploadId);
  if (!upload) return;
  const umschlag = await ladeUmschlag(uploadId, !!upload.callbackUrl);
  if (!umschlag || umschlag.status === 'verarbeitung') return;
  await updateUpload(uploadId, { abrechnung: umschlag.abrechnung });
  if (!upload.callbackUrl) return;
  if (!(await claimUmschlagZustellung(uploadId))) return; // bereits zugestellt oder in Zustellung

  const { deliverWebhook } = await import('../learning/webhook');
  const { getProject } = await import('../learning/projects');
  // Signatur: Schluessel der Pipeline, wenn genau eine betroffen ist; sonst Instanz-Schluessel (falls gesetzt).
  const pipelines = [...new Set(upload.parts.map((t) => t.targetProjectId).filter((x): x is string => !!x))];
  const secret = pipelines.length === 1 ? (await getProject(pipelines[0]!))?.webhook?.secret : process.env.EXTRACTION_WEBHOOK_SECRET || undefined;
  const r = await deliverWebhook(upload.callbackUrl, secret, { event_id: `${uploadId}:fertig`, event: 'inbox.completed', ...umschlag }, 'inbox.completed');
  await updateUpload(uploadId, { webhookStatus: r.delivered ? 'zugestellt' : 'fehlgeschlagen', webhookError: r.error ?? null });
  console.log(`[inbox] Umschlag ${uploadId} ${r.delivered ? 'zugestellt' : `nicht zugestellt (${r.error})`}`);
}

/** Nach einem abgeschlossenen Batch-Lauf: betroffene Uploads abschliessen. Wirft nie. */
export async function umschlagNachLauf(runId: string): Promise<void> {
  try {
    const uploads = [...new Set((await findPartsByRunId(runId)).map((p) => p.uploadId))];
    for (const id of uploads) await umschlagAbschliessen(id);
  } catch (err) {
    console.error('[inbox] Umschlag-Abschluss fehlgeschlagen:', err instanceof Error ? err.message : err);
  }
}
