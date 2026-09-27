/**
 * Token-Messbereich — sammelt den Token-Verbrauch aller LLM-Aufrufe, die innerhalb
 * von `mitTokenMessung(fn)` stattfinden (auch tief verschachtelt in Plattform-
 * Pipelines). Die Adapter melden jede Antwort über `meldeTokenVerbrauch`.
 *
 * Messbereiche dürfen geschachtelt werden: eine Meldung zählt in jedem offenen
 * Bereich der Kette. Ohne offenen Bereich ist alles ein No-op.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface ModellVerbrauch {
  aufrufe: number;
  promptTokens: number;
  completionTokens: number;
  ohneAngabe: number;
}

export interface TokenMessung {
  aufrufe: number;
  promptTokens: number;
  completionTokens: number;
  /** Aufrufe, zu denen der Anbieter keine Token-Zahlen geliefert hat. */
  ohneAngabe: number;
  modelle: Record<string, ModellVerbrauch>;
}

interface Bereich { messung: TokenMessung; eltern?: Bereich }

const speicher = new AsyncLocalStorage<Bereich>();

export function leereMessung(): TokenMessung {
  return { aufrufe: 0, promptTokens: 0, completionTokens: 0, ohneAngabe: 0, modelle: {} };
}

/** true, wenn ein Messbereich offen ist (Adapter fordern dann Usage im Stream an). */
export function tokenMessungAktiv(): boolean {
  return speicher.getStore() !== undefined;
}

/** Meldet einen abgeschlossenen LLM-Aufruf. `usage` fehlt → „ohne Angabe". */
export function meldeTokenVerbrauch(
  modell: string | undefined,
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null,
): void {
  let b = speicher.getStore();
  if (!b) return;
  const key = modell || 'unbekannt';
  const hatAngabe = typeof usage?.prompt_tokens === 'number' || typeof usage?.completion_tokens === 'number';
  const p = hatAngabe ? usage?.prompt_tokens ?? 0 : 0;
  const k = hatAngabe ? usage?.completion_tokens ?? 0 : 0;
  while (b) {
    const m = b.messung;
    const mm = (m.modelle[key] ??= { aufrufe: 0, promptTokens: 0, completionTokens: 0, ohneAngabe: 0 });
    m.aufrufe++; mm.aufrufe++;
    if (hatAngabe) {
      m.promptTokens += p; m.completionTokens += k;
      mm.promptTokens += p; mm.completionTokens += k;
    } else {
      m.ohneAngabe++; mm.ohneAngabe++;
    }
    b = b.eltern;
  }
}

/**
 * Führt `fn` in einem Messbereich aus. Die Messung ist auch bei Fehlern von `fn`
 * vollständig (sie wird vor dem Werfen über `beiEnde` herausgereicht).
 */
export async function mitTokenMessung<T>(
  fn: () => Promise<T>,
  beiEnde?: (messung: TokenMessung, dauerMs: number) => void | Promise<void>,
): Promise<{ ergebnis: T; messung: TokenMessung; dauerMs: number }> {
  const bereich: Bereich = { messung: leereMessung(), eltern: speicher.getStore() };
  const start = Date.now();
  try {
    const ergebnis = await speicher.run(bereich, fn);
    const dauerMs = Date.now() - start;
    await beiEnde?.(bereich.messung, dauerMs);
    return { ergebnis, messung: bereich.messung, dauerMs };
  } catch (err) {
    await beiEnde?.(bereich.messung, Date.now() - start);
    throw err;
  }
}
