/**
 * PA-Prüfagenten-Fan-out (Stufe 2): vier adversariale Agenten laufen parallel
 * zum deterministischen Checker (Stufe 1), jeder mit eigenem System-Prompt +
 * Refutationsauftrag. Ergebnisse werden gegen die Checker-Anker dedupliziert
 * (kein Doppel-Reporting) — Checker gewinnt bei Determinismus, Agent bei Kontext.
 *
 * Mit Adacor Qwen 3.5 Instruct (per ENV umschaltbar). Die LLM-Antwort ist
 * nicht-deterministisch; Parser, Dedupe und Prompt-Bau sind rein + testbar.
 */
import { llmService, type Message } from '../../../services/llm';
import type { PMFinding, Severity } from '../checker/types';
import { PA_AGENTS, buildSystemPrompt } from './agents';
import type { PAAgentId, PAAgentResult, PAFinding, PAFanoutResult } from './types';

export * from './types';
export { PA_AGENTS, buildSystemPrompt } from './agents';

const PA_MODEL = {
  providerId: process.env.ECHOLOOP_LLM_PROVIDER || 'adacor',
  modelId: process.env.ECHOLOOP_PA_MODEL || process.env.ECHOLOOP_LLM_MODEL || 'qwen3-5-a3b-35b-256k',
};

function normStatus(v: unknown): PAFinding['status'] {
  const s = String(v ?? '').toLowerCase();
  if (s.startsWith('beleg')) return 'belegt';
  if (s.startsWith('widerleg')) return 'widerlegt';
  return 'verify';
}
function normSchwere(v: unknown): Severity {
  const s = String(v ?? '').toLowerCase();
  if (s.startsWith('krit')) return 'kritisch';
  if (s.startsWith('hoch')) return 'hoch';
  if (s.startsWith('nied')) return 'niedrig';
  if (s.startsWith('frage') || s.startsWith('verify')) return 'frage';
  return 'mittel';
}

/** Parst die (JSON-)Antwort eines Agenten in ein strukturiertes Ergebnis. */
export function parseAgentResponse(agent: PAAgentId, content: string): PAAgentResult {
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```json|```/gi, '');
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return { agent, befunde: [], zusammenfassung: '', nichtGeprueft: [], fehler: 'Antwort nicht als JSON parsebar' };
  try {
    const p = JSON.parse(match[0]) as Record<string, unknown>;
    const roh = Array.isArray(p.befunde) ? p.befunde : [];
    let lfd = 0;
    const befunde: PAFinding[] = roh
      .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object' && !!(b as Record<string, unknown>).prozess)
      .map((b) => {
        lfd++;
        const schrittRaw = b.schritt;
        const schrittId = schrittRaw != null && schrittRaw !== '' && !Number.isNaN(Number(schrittRaw)) ? Number(schrittRaw) : undefined;
        return {
          agent, id: `${agent}-${lfd}`,
          titel: String(b.titel ?? 'Befund'),
          prozessNr: String(b.prozess),
          schrittId,
          beleg: String(b.beleg ?? '').split('\n').slice(0, 12).join('\n'),
          status: normStatus(b.status),
          schwere: normSchwere(b.schwere),
          dimensionen: Array.isArray(b.dimensionen) ? b.dimensionen.map(String) : [],
          refutation: String(b.refutation ?? ''),
          empfehlung: String(b.empfehlung ?? ''),
          beobachtend: true, // 0-FP-Regel: neu = beobachtend bis Fixture-Validierung
        } satisfies PAFinding;
      });
    return {
      agent, befunde,
      zusammenfassung: String(p.zusammenfassung ?? ''),
      nichtGeprueft: Array.isArray(p.nichtGeprueft) ? p.nichtGeprueft.map(String) : [],
    };
  } catch {
    return { agent, befunde: [], zusammenfassung: '', nichtGeprueft: [], fehler: 'JSON-Fehler' };
  }
}

/**
 * Merge/Dedupe gegen die Checker-Anker: widerlegte Befunde fallen raus; Befunde
 * an einer Fundstelle, an der bereits ein Checker-Anker sitzt, werden zusammen-
 * geführt (nicht doppelt gemeldet). Rein, testbar.
 */
export function dedupeGegenChecker(pa: PAFinding[], pm: PMFinding[]): Omit<PAFanoutResult, 'agenten'> {
  const ankerLoc = new Set(pm.filter((f) => f.schrittId != null).map((f) => `${f.prozessNr}:${f.schrittId}`));
  let zusammengefuehrt = 0;
  const befunde: PAFinding[] = [];
  for (const f of pa) {
    if (f.status === 'widerlegt') continue;
    if (f.schrittId != null && ankerLoc.has(`${f.prozessNr}:${f.schrittId}`)) { zusammengefuehrt++; continue; }
    befunde.push(f);
  }
  return { befunde, zusammengefuehrt, widersprueche: [] };
}

async function runOne(
  def: (typeof PA_AGENTS)[PAAgentId],
  userContent: string,
  ohneBetriebsdaten: boolean,
  userId: string | undefined,
  timeoutMs: number,
): Promise<PAAgentResult> {
  const system: Message = { role: 'system', content: buildSystemPrompt(def, ohneBetriebsdaten) };
  const user: Message = { role: 'user', content: userContent };
  try {
    const res = await Promise.race([
      llmService.chat([system, user], undefined, { source: 'document_analysis', operation: 'echoloop_pa', triggeringUserId: userId, userId }, { modelOverride: PA_MODEL }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`PA-Timeout nach ${timeoutMs}ms`)), timeoutMs)),
    ]);
    return parseAgentResponse(def.id, res.content ?? '');
  } catch (err) {
    return { agent: def.id, befunde: [], zusammenfassung: '', nichtGeprueft: [], fehler: err instanceof Error ? err.message : String(err) };
  }
}

/** Fährt die vier Agenten parallel und dedupliziert gegen die Checker-Befunde. */
export async function runPruefagenten(opts: {
  exportText: string;
  checkerFindings: PMFinding[];
  betriebsdaten?: string;
  userId?: string;
  timeoutMs?: number;
  onProgress?: (agent: PAAgentId, status: 'start' | 'done') => void | Promise<void>;
}): Promise<PAFanoutResult> {
  const timeoutMs = opts.timeoutMs ?? (Number(process.env.ECHOLOOP_PA_TIMEOUT_MS) || 90_000);
  const ohneBetriebsdaten = !opts.betriebsdaten;
  const base = `## Prozess-Export (Familie)\n${opts.exportText.slice(0, 16000)}`;
  const mitBd = opts.betriebsdaten ? `${base}\n\n## Betriebsdaten\n${opts.betriebsdaten.slice(0, 6000)}` : base;

  const agenten = await Promise.all(
    (Object.keys(PA_AGENTS) as PAAgentId[]).map(async (id) => {
      const def = PA_AGENTS[id];
      await opts.onProgress?.(id, 'start');
      const content = def.brauchtBetriebsdaten ? mitBd : base;
      const r = await runOne(def, content, ohneBetriebsdaten, opts.userId, timeoutMs);
      await opts.onProgress?.(id, 'done');
      return r;
    }),
  );

  const alle = agenten.flatMap((a) => a.befunde);
  const merged = dedupeGegenChecker(alle, opts.checkerFindings);
  return { agenten, ...merged };
}
