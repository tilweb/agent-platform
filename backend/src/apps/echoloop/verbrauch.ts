/**
 * /verbrauch — Token-/Verbrauchs-Messung (Referenz verbrauch.py v2 +
 * STANDARD_Verbrauch-und-Sicherheit_v1). Selbstmessung statt Selbstmeldung:
 * je LLM-Zug die vier Token-Felder + Modell, daraus Kosten (Schätzung),
 * Kontext-Wiederholungs-Anteil und Budget-/Schwellen-Ampel.
 *
 * Token-Zahlen sind exakt (aus der Antwort), USD ist SCHÄTZUNG bis geeicht
 * (`_geprueft_am` in der Preistabelle) — ohne Eichstand gilt jede USD-Zahl als ❓.
 * Speist die append-only Telemetrie-Senke (`el_telemetrie`, verfahren='verbrauch',
 * data.tokens) — dieselbe Lehre wie die Senke: Selbstmeldung IM Werkzeug schlägt Disziplin.
 *
 * Rein & deterministisch. Kalibriert an der Preistabelle + dem Beleg-Tag 06.08.2026.
 */

/** Vier-Felder-Verbrauch eines LLM-Zugs. */
export interface ZugVerbrauch {
  model: string;
  in: number;   // frische Eingabe (input_tokens)
  cr: number;   // wiederholter Kontext (cache_read_input_tokens) — der stille Kostentreiber
  cw: number;   // neu in den Cache geschrieben (cache_creation_input_tokens)
  out: number;  // erzeugter Text (output_tokens)
}

export interface Preis { in: number; out: number; cacheRead: number; cacheWrite: number; }

/** Preistabelle in USD je 1 Mio Token (Referenz verbrauch.py PREISE_VORGABE). */
export const PREISE: Record<string, Preis> = {
  'claude-opus-5': { in: 15.0, out: 75.0, cacheRead: 1.50, cacheWrite: 18.75 },
  'claude-fable-5': { in: 15.0, out: 75.0, cacheRead: 1.50, cacheWrite: 18.75 },
  'claude-sonnet-5': { in: 3.0, out: 15.0, cacheRead: 0.30, cacheWrite: 3.75 },
  'claude-haiku-4-5-20251001': { in: 1.0, out: 5.0, cacheRead: 0.10, cacheWrite: 1.25 },
  _default: { in: 15.0, out: 75.0, cacheRead: 1.50, cacheWrite: 18.75 },
};

/** Kontext-Wächter-Schwellen je Zug (STANDARD §3 R1 / SKILL). */
export const SCHWELLEN = { warn: 400_000, halt: 600_000, schnitt: 800_000 } as const;

/** Budget-Sicherheitsstufen (STANDARD §4). Der Wächter blockiert nie. */
export const BUDGET_DEFAULT_USD = 150;

function preis(model: string): Preis {
  return PREISE[model] ?? PREISE._default!;
}

/** Geschätzte Kosten eines Zugs in USD (SCHÄTZUNG bis geeicht). */
export function kosten(z: ZugVerbrauch): number {
  const p = preis(z.model);
  return (z.in * p.in + z.out * p.out + z.cr * p.cacheRead + z.cw * p.cacheWrite) / 1e6;
}

/** Kontext eines Zugs = frische Eingabe + wiederholter Kontext + Cache-Schreiben. */
export function kontext(z: ZugVerbrauch): number {
  return z.in + z.cr + z.cw;
}

export interface VerbrauchSumme {
  zuege: number;
  in: number; cr: number; cw: number; out: number;
  usd: number;
  /** Kontext-Wiederholungs-Anteil in % = cr / (in+cr+cw). */
  wiederholAnteil: number;
  /** mittlerer Kontext je Zug (cr/zuege) — Leitkennzahl der wöchentlichen Kontrolle. */
  kontextJeZug: number;
  jeModell: Record<string, { zuege: number; usd: number }>;
  /** Züge über der 600k-Kontext-Schwelle (Preis langer Sessions). */
  ueber600k: number;
}

/** Aggregiert eine Zug-Liste (Referenz verbrauch.py `_summe`). */
export function summe(zuege: ZugVerbrauch[]): VerbrauchSumme {
  const s: VerbrauchSumme = { zuege: zuege.length, in: 0, cr: 0, cw: 0, out: 0, usd: 0, wiederholAnteil: 0, kontextJeZug: 0, jeModell: {}, ueber600k: 0 };
  for (const z of zuege) {
    s.in += z.in; s.cr += z.cr; s.cw += z.cw; s.out += z.out;
    s.usd += kosten(z);
    const m = (s.jeModell[z.model] ??= { zuege: 0, usd: 0 });
    m.zuege++; m.usd += kosten(z);
    if (kontext(z) > SCHWELLEN.halt) s.ueber600k++;
  }
  const gesamtEingabe = s.in + s.cr + s.cw;
  s.wiederholAnteil = gesamtEingabe > 0 ? Math.round((s.cr / gesamtEingabe) * 1000) / 10 : 0;
  s.kontextJeZug = s.zuege > 0 ? Math.round(s.cr / s.zuege) : 0;
  s.usd = Math.round(s.usd * 100) / 100;
  return s;
}

export type BudgetStufe = 'ok' | 'hinweis' | 'warnung' | 'stopp';

/** Budget-Ampel: 🟡 50% Hinweis · 🟠 80% Warnung · 🔴 100% (nachladen), STANDARD §4. */
export function budgetStufe(usd: number, budget = BUDGET_DEFAULT_USD): BudgetStufe {
  const anteil = budget > 0 ? usd / budget : 0;
  if (anteil >= 1.0) return 'stopp';
  if (anteil >= 0.8) return 'warnung';
  if (anteil >= 0.5) return 'hinweis';
  return 'ok';
}

/** Kontext-Wächter-Stufe eines einzelnen Zugs (je Schwelle genau einmal beim Konsumenten). */
export function kontextWaechter(kontextZug: number): 'ok' | 'warn' | 'halt' | 'schnitt' {
  if (kontextZug >= SCHWELLEN.schnitt) return 'schnitt';
  if (kontextZug >= SCHWELLEN.halt) return 'halt';
  if (kontextZug >= SCHWELLEN.warn) return 'warn';
  return 'ok';
}
