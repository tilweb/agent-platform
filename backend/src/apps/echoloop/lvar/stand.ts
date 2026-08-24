/**
 * LvarStand — der menschliche Arbeitsstand über dem berechneten `LvarErgebnis`
 * (Sebs `window.STAND`, serverseitig statt in der Datei).
 *
 * Eine flache Map `feldToken → Wert`. Die Token-IDs sind **append-only** (D-061):
 * nie umbenennen/umnummerieren, sonst verlieren gespeicherte Stände ihre Häkchen.
 * Konvention (Frontend erzeugt sie aus den berechneten Karten):
 *   Umbenennen-Karte:  UB-<alt>-st (Status) · UB-<alt>-fb (Feedback) · UB-<alt>-hak (Vorabhaken)
 *   Steckbrief:        SB-<nr>-typ · SB-<nr>-krit · SB-<nr>-beschr · …
 *   CFG-Schlüssel:     CFG-<key>-hak · CFG-<key>-wahl
 *   NK-Feedback:       NK-fb
 *
 * Backend-seitig ist der Stand opak (nur String/Boolean-Werte); die Bedeutung
 * lebt im Frontend. `sanitizeStand` hält die Ablage klein und typrein.
 */
export type LvarStand = Record<string, string | boolean>;

const MAX_TOKENS = 20_000;   // großzügig (echte Familien: ~4000 data-i-Token)
const MAX_LEN = 4_000;       // je Feedback-Feld

/** Nimmt nur String/Boolean-Werte an, kürzt überlange Texte, deckelt die Token-Zahl. */
export function sanitizeStand(raw: unknown): LvarStand {
  if (!raw || typeof raw !== 'object') return {};
  const out: LvarStand = {};
  let n = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= MAX_TOKENS) break;
    if (typeof v === 'boolean') { out[k] = v; n++; }
    else if (typeof v === 'string') { out[k] = v.length > MAX_LEN ? v.slice(0, MAX_LEN) : v; n++; }
    // andere Typen werden verworfen (kein Raten, keine verschachtelten Objekte im Stand)
  }
  return out;
}
