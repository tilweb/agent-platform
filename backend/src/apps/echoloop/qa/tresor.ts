/**
 * Tresor-Sweep — „kein Secret in Baustand/Artefakt/Export" (PAKET_2
 * LIESMICH_ADACOR: Zugangsdaten gehören in den Tresor, nicht ins Repository;
 * ein Sweep prüft das bei jedem Paket-Bau und bricht ab).
 *
 * Zwei Modi, entlang Prinzip §3 (das Ergebnis prüft sich selbst; FAIL bricht ab):
 *  · `redactExtract` — VOR dem Persistieren: EMMA-`password`-Variablen und
 *    secret-verdächtige Init-Werte werden geschwärzt, Fund als Telemetrie notiert.
 *    Nicht-blockierend: die Analyse läuft weiter, nur ohne den Klartext.
 *  · `assertTresorClean` — VOR Export/Paket-Bau: harter Gate, wirft `TresorError`
 *    bei jedem Fund. Kein ungeprüftes Ergebnis verlässt die App.
 *
 * Rein & deterministisch (kein LLM), damit als `bun test`-Gate verankerbar.
 */
import type { EmmaVariable } from '../extract/emma';

export interface TresorFinding {
  klasse: string;   // password-variable | private-key | api-token | jwt | bearer | url-credential | connection-string | cloud-key
  fundort: string;  // z.B. "variable P210/id42 (Init)" oder "text:beschreibung"
  auszug: string;   // bereits geschwärzter Ausschnitt
}

export interface TresorResult {
  clean: boolean;
  findings: TresorFinding[];
}

/** Secret-Muster (konservativ gewählt — Klartext-Marker, nicht Entropie-Raten). */
const PATTERNS: { klasse: string; re: RegExp }[] = [
  { klasse: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g },
  { klasse: 'jwt', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  { klasse: 'cloud-key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { klasse: 'cloud-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { klasse: 'api-token', re: /\bghp_[A-Za-z0-9]{36}\b/g },
  { klasse: 'api-token', re: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g },
  { klasse: 'api-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { klasse: 'api-token', re: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { klasse: 'bearer', re: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/g },
  { klasse: 'url-credential', re: /[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^:/\s@]+:[^@/\s]{3,}@/g },
  // Schlüssel=Wert-Zuweisungen (dt./engl.), inkl. Connection-String-Fragmente:
  { klasse: 'connection-string', re: /\b(?:password|passwort|kennwort|pwd|passwd)\s*[=:]\s*(?!["']?\s*(?:$|[;&]))["']?[^\s;&"']{3,}/gi },
  { klasse: 'api-token', re: /\b(?:api[_-]?key|secret|client[_-]?secret|access[_-]?token|auth[_-]?token|token)\s*[=:]\s*["']?[A-Za-z0-9._\-]{12,}/gi },
];

/** Schwärzt einen Wert: erste/letzte 2 Zeichen sichtbar, Mitte maskiert. */
export function redact(s: string): string {
  const t = s.trim();
  if (t.length <= 6) return '••••';
  return `${t.slice(0, 2)}…${t.slice(-2)} (${t.length} Z., geschwärzt)`;
}

/** Scannt freien Text auf Secret-Muster. */
export function sweepText(text: string, fundort: string): TresorFinding[] {
  const out: TresorFinding[] = [];
  for (const { klasse, re } of PATTERNS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) out.push({ klasse, fundort, auszug: redact(m[0]) });
  }
  return out;
}

/**
 * EMMA-Variablen-Sweep: `password`-Typ mit gefülltem Init = Klartext-Credential;
 * zusätzlich jeder Init-Wert, der ein Secret-Muster trifft (unabhängig vom Typ).
 */
export function sweepVariablen(vars: EmmaVariable[]): TresorFinding[] {
  const out: TresorFinding[] = [];
  for (const v of vars) {
    const init = (v.init ?? '').trim();
    const ort = `variable P${v.p}/id${v.id} (Init)`;
    if (v.typ === 'password' && init) {
      out.push({ klasse: 'password-variable', fundort: ort, auszug: redact(init) });
      continue; // ein Fund je Variable genügt
    }
    if (init) out.push(...sweepText(init, ort));
  }
  return out;
}

/** Nicht-destruktiver Gesamt-Sweep über Text, Variablen und beliebige Objekte. */
export function tresorSweep(input: { text?: string; variablen?: EmmaVariable[]; objekt?: unknown }): TresorResult {
  const findings: TresorFinding[] = [];
  if (input.text) findings.push(...sweepText(input.text, 'text'));
  if (input.variablen) findings.push(...sweepVariablen(input.variablen));
  if (input.objekt !== undefined) findings.push(...sweepText(JSON.stringify(input.objekt), 'objekt'));
  return { clean: findings.length === 0, findings };
}

/** Harter Gate für Export/Paket-Bau: wirft bei jedem Fund. */
export class TresorError extends Error {
  constructor(public readonly findings: TresorFinding[]) {
    super(`Tresor-Sweep gestoppt: ${findings.length} Credential-Fund(e) — ` +
      findings.map((f) => `${f.klasse}@${f.fundort}`).join(', '));
    this.name = 'TresorError';
  }
}

export function assertTresorClean(input: { text?: string; variablen?: EmmaVariable[]; objekt?: unknown }): void {
  const r = tresorSweep(input);
  if (!r.clean) throw new TresorError(r.findings);
}

/**
 * Redaktion vor dem Persistieren: gibt eine bereinigte Variablen-Kopie zurück
 * (Klartext-Init geschwärzt) plus die Fundliste. Nicht-blockierend.
 */
export function redactVariablen(vars: EmmaVariable[]): { variablen: EmmaVariable[]; findings: TresorFinding[] } {
  const findings = sweepVariablen(vars);
  if (!findings.length) return { variablen: vars, findings };
  const betroffen = new Set(findings.map((f) => f.fundort));
  const variablen = vars.map((v) =>
    betroffen.has(`variable P${v.p}/id${v.id} (Init)`) ? { ...v, init: '🔒 [Tresor]' } : v,
  );
  return { variablen, findings };
}
