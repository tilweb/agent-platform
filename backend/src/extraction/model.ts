/**
 * Festes Modell für die Dokumenten-Extraktion.
 *
 * Die Extraktion lief bisher auf dem *aktiven* System-Modell — und
 * `resolveActiveModel` zieht davor noch die **Modellwahl des Nutzers** für die
 * laufende Session. Damit hing die Qualität (und die Laufzeit) einer Extraktion
 * daran, was gerade im Chat eingestellt war. Zwei Probleme:
 *
 *   1. Fachlich: Die Prompts, Few-Shot-Beispiele und Function-Schemata des
 *      Features sind auf ein Instruct-Modell mit Function-Calling ausgelegt.
 *      Ein Reasoning- oder Chat-Modell liefert dort schlechtere Ergebnisse,
 *      ohne dass es jemand merkt.
 *   2. Betrieb: Hängt das aktive Modell, hängt die gesamte Extraktion. Genau das
 *      ist am 2026-08-04 passiert — das aktive Chat-Modell (Nebius/Kimi-K3) kam
 *      auf ein triviales Prompt 120 s lang nicht zurück, während Adacor in unter
 *      einer Sekunde antwortete.
 *
 * Deshalb bindet das Feature sein Modell selbst: **Adacor Qwen 3.5 Instruct 35B**
 * (chat + function_calling + vision — deckt alle vier Strategien ab). Die
 * Session-/Nutzerwahl spielt für die Extraktion bewusst keine Rolle mehr.
 *
 * Zwei Ausnahmen bleiben absichtlich möglich:
 *   - das **projekteigene** Modell (Projekt-Einstellungen → „KI-Modell"), eine
 *     bewusste fachliche Entscheidung pro Projekt, und
 *   - die ENV-Variablen unten, für Instanzen ohne Adacor-Zugang.
 *
 * Gleiches Muster wie bei Echo-Loop (`ECHOLOOP_LLM_*`).
 */

/** Provider-Id des Extraktions-Modells. */
export const EXTRACTION_PROVIDER_ID = process.env.EXTRACTION_LLM_PROVIDER || 'adacor';
/** Modell-Id des Extraktions-Modells. */
export const EXTRACTION_MODEL_ID = process.env.EXTRACTION_LLM_MODEL || 'qwen3-5-a3b-35b-256k';

/** Form für `ExtractionConfig.model_override` (snake_case). */
export function extractionModelConfig(): { provider_id: string; model_id: string } {
  return { provider_id: EXTRACTION_PROVIDER_ID, model_id: EXTRACTION_MODEL_ID };
}

/** Form für `ChatOptions.modelOverride` (camelCase). */
export function extractionModelOverride(): { providerId: string; modelId: string } {
  return { providerId: EXTRACTION_PROVIDER_ID, modelId: EXTRACTION_MODEL_ID };
}

/** Anzeige-/Audit-Label, z.B. "adacor/qwen3-5-a3b-35b-256k". */
export function extractionModelLabel(): string {
  return `${EXTRACTION_PROVIDER_ID}/${EXTRACTION_MODEL_ID}`;
}
