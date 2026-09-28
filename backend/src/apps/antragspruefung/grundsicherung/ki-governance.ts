/**
 * Grundsicherung — KI-Governance-Konstanten und Helfer (AI Act Art. 12/13/14, Art. 22 DSGVO).
 *
 * Jeder LLM-Aufruf der App soll nachvollziehbar machen, WELCHES Modell und WELCHER Prompt-/
 * Profil-Stand eine Ausgabe erzeugt hat. Der Posteingang liest Unterlagen ausschließlich über
 * das DP-Segmentprofil „Grundsicherung-Eingang"; dessen `extract()` nimmt (Stand heute) keinen
 * `usageContext` entgegen. Die Governance-Metadaten landen deshalb am KI-Verbrauch-Datensatz
 * (`detail`) und an jedem Dokument (`profil.vorlageStand`, `profil.profilHash`). Für eigene
 * LLM-Aufrufe (z. B. späterer Fall-Chat) liefert `grundsicherungUsageMetadata` den
 * `usageContext.metadata`-Block wie bei Wohngeld.
 */
import { GRUNDSICHERUNG_PROFIL_ID, GRUNDSICHERUNG_PROFIL_VORLAGE_STAND } from '../../../extraction/templates/grundsicherung-eingang';

/** Stand der Assistenz-Logik (Prompts, Abbildung Profil → Vertrag). Bei fachlichen Änderungen HOCHZÄHLEN. */
export const GRUNDSICHERUNG_PROMPT_VERSION = '2026-09-27';

/** Metadaten-Block für `usageContext.metadata` eines Grundsicherungs-LLM-Aufrufs. */
export function grundsicherungUsageMetadata(opts: {
  providerId?: string;
  modelId?: string;
  vorgangId?: string;
  posteingangId?: string;
}): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    app: 'grundsicherung',
    promptVersion: GRUNDSICHERUNG_PROMPT_VERSION,
    profilId: GRUNDSICHERUNG_PROFIL_ID,
    profilVorlage: GRUNDSICHERUNG_PROFIL_VORLAGE_STAND,
  };
  if (opts.modelId) meta.modelId = opts.modelId;
  if (opts.providerId) meta.providerId = opts.providerId;
  if (opts.vorgangId) meta.vorgangId = opts.vorgangId;
  if (opts.posteingangId) meta.posteingangId = opts.posteingangId;
  return meta;
}

/** Kurzform der Governance-Metadaten für das `detail` eines KI-Verbrauch-Datensatzes. */
export function governanceDetail(text: string): string {
  return `${text} · Profil ${GRUNDSICHERUNG_PROFIL_ID} (Vorlage ${GRUNDSICHERUNG_PROFIL_VORLAGE_STAND}) · Prompt-Stand ${GRUNDSICHERUNG_PROMPT_VERSION}`;
}
