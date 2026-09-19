/**
 * Wohngeld GOV-3 — KI-Governance-Konstanten & Helfer (AI Act Art. 12/13/14, Art. 22 DSGVO).
 *
 * Bei JEDEM LLM-Aufruf der App wird ein vollstaendiger `usageContext` gesetzt,
 * damit im Nachhinein nachvollziehbar ist, WELCHES Modell und WELCHE Wissensbasis
 * (Prompt-/Regelkatalog-Version, Rechtsstand) eine Assistenz-Antwort erzeugt hat.
 * Diese Metadaten landen in `audit.usage_log.metadata` und speisen die
 * Sicht „KI-Nutzung je Vorgang" (siehe storage.listKiNutzung).
 */
import { RECHTSSTAND } from './recht/corpus';

/**
 * Version des Prompt-/Regelkatalog-Standes der App. Bei fachlich relevanten
 * Aenderungen an System-Prompts oder Extraktions-/Chat-Regeln HOCHZAEHLEN —
 * so ist im Usage-Log erkennbar, unter welcher Assistenz-Logik eine Antwort
 * entstand (Nachvollziehbarkeit i. S. v. AI Act Art. 12).
 */
export const WOHNGELD_PROMPT_VERSION = '2026-09-19';

/** Stand des hinterlegten Rechts-Korpus (WoGG/WoGV) — Quelle fuer Chat-Rechtsaussagen. */
export const WOHNGELD_RECHT_STAND = RECHTSSTAND;

/**
 * Baut den `metadata`-Block fuer einen Wohngeld-LLM-Aufruf. `resourceId` (Fallbezug)
 * wird zusaetzlich als `vorgangId` in die Metadaten gespiegelt, damit die
 * KI-Nutzungs-Sicht auch dann filtern kann, wenn `resourceId` anders belegt ist.
 */
export function wohngeldUsageMetadata(opts: {
  providerId: string;
  modelId: string;
  vorgangId?: string;
  /** true, wenn der Rechts-Korpus in den Prompt einfliesst (Fall-Chat). */
  mitRechtKorpus?: boolean;
}): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    modelId: opts.modelId,
    providerId: opts.providerId,
    promptVersion: WOHNGELD_PROMPT_VERSION,
  };
  if (opts.vorgangId) meta.vorgangId = opts.vorgangId;
  if (opts.mitRechtKorpus) meta.rechtStand = WOHNGELD_RECHT_STAND;
  return meta;
}
