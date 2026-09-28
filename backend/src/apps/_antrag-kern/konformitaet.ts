/**
 * Antrag-Kern — Konformitätsprüfung (Muster Abschnitt 8), statisch über den Quelltext.
 *
 * Prüft eine Antrags-App anhand ihres Ordners, ohne Laufzeit und ohne Datenbank:
 *  - Audit:           jede direkt registrierte Schreibroute protokolliert (`audit`/`auditUpdate`,
 *                     auch über eine Funktion derselben Datei, die das nachweislich tut).
 *  - KI-Verbrauch:    jede Route, die einen LLM-Einstieg erreicht, misst (`messeKiVerbrauch`);
 *                     LLM-Aufrufe außerhalb der Routen nur in deklarierten LLM-Modulen.
 *  - Einschränkung:   jede vorgangsbezogene Schreibroute prüft Art. 18 (`denyIf…Eingeschraenkt`).
 *
 * Grenzen werden pragmatisch bestimmt: Literale und Kommentare werden ausgeblendet, danach
 * reicht ein Handler von `x.post(` bis zur schließenden Klammer, eine Funktion über ihren Rumpf.
 * Routen aus Kern-Fabriken (`createAuditRoutes` usw.) sind hier nicht sichtbar; die Fabriken
 * selbst prüft `konformitaet.test.ts` im Kern.
 *
 * Ergebnis je Prüfung: gefundene Verstöße (als Schlüssel `METHODE /pfad` bzw. Datei) und
 * Ausnahmen, die nicht (mehr) gebraucht werden — beides soll im Test leer sein bzw. genau der
 * bewusst geführten Liste offener Verstöße entsprechen.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ── Quelltext aufbereiten ───────────────────────────────────────────────────

const REGEX_VORGAENGER = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const REGEX_SCHLUESSELWORTE = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'void', 'yield', 'await', 'instanceof']);

/**
 * Ersetzt den Inhalt von Kommentaren, String-, Template- und Regex-Literalen durch Leerzeichen
 * (Zeilenumbrüche und Offsets bleiben erhalten; `${…}` in Templates bleibt Code). Danach sind
 * Klammern im Ergebnis nur noch Code-Klammern.
 */
export function ohneLiterale(src: string): string {
  const out = src.split('');
  const n = src.length;
  const leere = (a: number, b: number) => { for (let k = a; k < b && k < n; k++) if (out[k] !== '\n') out[k] = ' '; };
  const tplStapel: number[] = [];
  let tiefe = 0;
  let zuletzt = '';
  let i = 0;

  /** i steht hinter einem öffnenden Backtick bzw. hinter der `}` eines `${…}`. */
  const template = () => {
    const start = i;
    while (i < n) {
      const ch = src[i];
      if (ch === '\\') { i += 2; continue; }
      if (ch === '`') { leere(start, i); i++; zuletzt = 'a'; return; }
      if (ch === '$' && src[i + 1] === '{') { leere(start, i); i += 2; tplStapel.push(tiefe); tiefe++; zuletzt = '{'; return; }
      i++;
    }
    leere(start, n);
  };

  while (i < n) {
    const ch = src[i]!;
    const nx = src[i + 1];
    if (ch === '/' && nx === '/') { const e = src.indexOf('\n', i); const ende = e === -1 ? n : e; leere(i, ende); i = ende; continue; }
    if (ch === '/' && nx === '*') { const e = src.indexOf('*/', i + 2); const ende = e === -1 ? n : e + 2; leere(i, ende); i = ende; continue; }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n && src[j] !== ch && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      leere(i + 1, j); i = j + 1; zuletzt = 'a'; continue;
    }
    if (ch === '`') { i++; template(); continue; }
    if (ch === '/' && (REGEX_VORGAENGER.has(zuletzt) || REGEX_SCHLUESSELWORTE.has(zuletzt))) {
      let j = i + 1;
      let klasse = false;
      let ok = false;
      while (j < n) {
        const c = src[j];
        if (c === '\\') { j += 2; continue; }
        if (c === '\n') break;
        if (c === '[') klasse = true;
        else if (c === ']') klasse = false;
        else if (c === '/' && !klasse) { ok = true; break; }
        j++;
      }
      if (ok) {
        leere(i + 1, j);
        i = j + 1;
        while (i < n && /[a-z]/i.test(src[i]!)) i++;
        zuletzt = 'a';
        continue;
      }
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[\w$]/.test(src[j]!)) j++;
      zuletzt = src.slice(i, j); i = j; continue;
    }
    if (ch === '{') tiefe++;
    if (ch === '}') {
      tiefe--;
      if (tplStapel.length && tiefe === tplStapel[tplStapel.length - 1]) { tplStapel.pop(); i++; template(); continue; }
    }
    if (!/\s/.test(ch)) zuletzt = /[\w$]/.test(ch) ? 'a' : ch;
    i++;
  }
  return out.join('');
}

const PAARE: Record<string, string> = { '(': ')', '{': '}', '[': ']' };

/** Index der zur Klammer an `auf` passenden schließenden Klammer (auf literalfreiem Code). */
export function klammerEnde(code: string, auf: number): number {
  const o = code[auf]!;
  const z = PAARE[o];
  if (!z) throw new Error(`keine öffnende Klammer an ${auf}`);
  let t = 0;
  for (let i = auf; i < code.length; i++) {
    if (code[i] === o) t++;
    else if (code[i] === z && --t === 0) return i;
  }
  return code.length - 1;
}

function zeileVon(code: string, pos: number): number {
  let z = 1;
  for (let i = 0; i < pos; i++) if (code[i] === '\n') z++;
  return z;
}

// ── Routen und Funktionen finden ────────────────────────────────────────────

export type Methode = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export const SCHREIB_METHODEN: ReadonlySet<Methode> = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface RoutenHandler {
  datei: string;
  methode: Methode;
  pfad: string;
  /** `METHODE /pfad` — Schlüssel für Ausnahmelisten. */
  schluessel: string;
  zeile: number;
  /** Handler-Code ohne Literale (von `x.post(` bis zur schließenden Klammer). */
  code: string;
}

export interface Funktion {
  name: string;
  zeile: number;
  /** Rumpf ohne Literale. */
  code: string;
}

/** Direkt registrierte Routen `x.get|post|put|patch|delete('/pfad', (c) => …)`. */
export function findeRouten(src: string, datei = '', code = ohneLiterale(src)): RoutenHandler[] {
  const out: RoutenHandler[] = [];
  const re = /(?<![\w$.])[A-Za-z_$][\w$]*\.(get|post|put|patch|delete)\(\s*(['"`])/g;
  for (const m of code.matchAll(re)) {
    const quoteAuf = m.index! + m[0].length - 1;
    const quoteZu = code.indexOf(m[2]!, quoteAuf + 1);
    if (quoteZu < 0) continue;
    if (!/^\s*,\s*(?:async\s*)?\(\s*c\s*(?::[^)]*)?\)\s*=>/.test(code.slice(quoteZu + 1, quoteZu + 80))) continue;
    const auf = code.indexOf('(', m.index!);
    const zu = klammerEnde(code, auf);
    const methode = m[1]!.toUpperCase() as Methode;
    const pfad = src.slice(quoteAuf + 1, quoteZu);
    out.push({ datei, methode, pfad, schluessel: `${methode} ${pfad}`, zeile: zeileVon(code, m.index!), code: code.slice(m.index!, zu + 1) });
  }
  return out;
}

/** Ausdrucks-Ende ab `start` (bis `;`, `,` oder schließende Klammer auf Tiefe 0). */
function ausdruckEnde(code: string, start: number): number {
  let t = 0;
  for (let i = start; i < code.length; i++) {
    const ch = code[i]!;
    if (ch === '(' || ch === '{' || ch === '[') t++;
    else if (ch === ')' || ch === '}' || ch === ']') { if (t === 0) return i - 1; t--; }
    else if ((ch === ';' || ch === ',') && t === 0) return i - 1;
  }
  return code.length - 1;
}

/** Beginn des Funktionsrumpfs nach der Parameterliste (überspringt Rückgabetyp-Annotationen). */
function rumpfStart(code: string, pos: number): number {
  let winkel = 0;
  for (let i = pos; i < code.length; i++) {
    const ch = code[i]!;
    if (ch === '=' && code[i + 1] === '>') { i++; continue; }
    if (ch === '<') winkel++;
    else if (ch === '>') winkel--;
    else if (ch === '{') {
      const vor = code.slice(pos, i).trimEnd().slice(-1);
      if (winkel > 0 || [':', '|', '&', ',', '(', '<'].includes(vor)) { i = klammerEnde(code, i); continue; }
      return i;
    } else if (ch === ';') return -1;
  }
  return -1;
}

/** Benannte Funktionen: `function name(…) {…}` und `const name = (async) (…) => …`. */
export function findeFunktionen(src: string, code = ohneLiterale(src)): Funktion[] {
  const out: Funktion[] = [];
  for (const m of code.matchAll(/(?<![\w$])function\s*\*?\s*([A-Za-z_$][\w$]*)\s*(?:<[^>(]*>)?\s*\(/g)) {
    const auf = m.index! + m[0].length - 1;
    const r = rumpfStart(code, klammerEnde(code, auf) + 1);
    if (r < 0) continue;
    out.push({ name: m[1]!, zeile: zeileVon(code, m.index!), code: code.slice(r, klammerEnde(code, r) + 1) });
  }
  const pfeil = /(?<![\w$.])(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*(?:async\s*)?(?:<[^>(]*>\s*)?\(/g;
  for (const m of code.matchAll(pfeil)) {
    const auf = m.index! + m[0].length - 1;
    const zu = klammerEnde(code, auf);
    const nach = code.slice(zu + 1).match(/^\s*(?::[^=;{]*)?=>\s*/);
    if (!nach) continue;
    const start = zu + 1 + nach[0].length;
    const ende = code[start] === '{' ? klammerEnde(code, start) : ausdruckEnde(code, start);
    out.push({ name: m[1]!, zeile: zeileVon(code, m.index!), code: code.slice(start, ende + 1) });
  }
  return out;
}

// ── Aufruf-Erkennung ────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Ruft `code` die Funktion `name` auf? `name` darf einen Punkt enthalten (`llmService.chat`,
 * `d.erkenne`). `mitEmpfaenger`: auch `x.name(` zählt (für injizierte Abhängigkeiten wie
 * `d.audit`, `opts.audit`). Deklarationen (`function name(`) zählen nicht.
 */
export function ruftAuf(code: string, name: string, mitEmpfaenger = false): boolean {
  const wort = /[\w$]/;
  for (let i = code.indexOf(name); i >= 0; i = code.indexOf(name, i + 1)) {
    const vor = code[i - 1] ?? '';
    if (wort.test(vor)) continue;
    if (vor === '.' && !mitEmpfaenger) continue;
    let j = i + name.length;
    if (wort.test(code[j] ?? '')) continue;
    while (/\s/.test(code[j] ?? '')) j++;
    if (code[j] === '?' && code[j + 1] === '.') j += 2;
    if (code[j] !== '(') continue;
    if (/function\s*\*?\s*$/.test(code.slice(Math.max(0, i - 20), i))) continue;
    return true;
  }
  return false;
}

function ruftEinenAuf(code: string, namen: Iterable<string>, mitEmpfaenger = false): string | undefined {
  for (const n of namen) if (ruftAuf(code, n, mitEmpfaenger)) return n;
  return undefined;
}

/**
 * Fixpunkt: Namen der Funktionen, die (direkt oder über eine andere gefundene Funktion)
 * `ziel` aufrufen. `sperre`: Funktionen, die einen dieser Namen aufrufen, zählen nicht
 * (z. B. Funktionen, die selbst messen).
 */
export function erreichend(
  funktionen: Funktion[],
  ziel: (code: string) => boolean,
  sperre?: (code: string) => boolean,
): Set<string> {
  const treffer = new Set<string>();
  let geaendert = true;
  while (geaendert) {
    geaendert = false;
    for (const f of funktionen) {
      if (treffer.has(f.name) || sperre?.(f.code)) continue;
      if (ziel(f.code) || ruftEinenAuf(f.code, treffer)) { treffer.add(f.name); geaendert = true; }
    }
  }
  return treffer;
}

// ── Dateien ─────────────────────────────────────────────────────────────────

function tsDateien(dir: string, rel = ''): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...tsDateien(join(dir, e.name), r));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) out.push(r);
  }
  return out.sort();
}

export interface Quelle { datei: string; src: string; code: string }

const cache = new Map<string, { src: string; code: string }>();

function lies(pfad: string): { src: string; code: string } {
  let e = cache.get(pfad);
  if (!e) {
    const src = readFileSync(pfad, 'utf8');
    e = { src, code: ohneLiterale(src) };
    cache.set(pfad, e);
  }
  return e;
}

/** Alle Nicht-Test-`.ts`-Dateien eines Ordners (rekursiv), Pfade relativ; `code` ohne Literale. */
export function leseQuellen(dir: string): Quelle[] {
  return tsDateien(dir).map((datei) => ({ datei, ...lies(join(dir, datei)) }));
}

// ── Prüfungen ───────────────────────────────────────────────────────────────

/** Muster, die einen LLM-Aufruf auslösen (Plattform-Einstiege + Kern-Grenzprüfung). */
export const LLM_EINSTIEGE_BASIS: readonly string[] = [
  'llmService.chat', 'llmService.streamChat', 'runPipeline', 'judgeBoundaries', 'extract', 'pruefeUndTrenne',
];

const AUDIT_NAMEN = ['audit', 'auditUpdate'];
const GATE_NAMEN = ['denyIfEingeschraenkt', 'denyIfVorgangEingeschraenkt'];

/** Default: Schreibroute ist vorgangsbezogen, wenn der Pfad einen Vorgang oder ein Vorgangsobjekt adressiert. */
export const VORGANGS_PFAD = /:vorgangId\b|^\/vorgaenge\/:id\b|^\/(?:dokumente|personen|pruefschritte|schreiben|notizen)\/:id\b/;

export interface KonformitaetsKonfig {
  /** Absoluter Pfad des App-Ordners. */
  appDir: string;
  /** Ordner der Routen-Dateien relativ zu `appDir` (Default `routes`). */
  routenOrdner?: string;
  /** Statt des Ordners: einzelne Dateien mit Routen (relativ zu `appDir`), z. B. Kern-Fabriken. */
  routenDateien?: string[];
  /** Exportierte LLM-Funktionen der App je Modul (relativ zu `appDir`). Nur diese Module dürfen LLM-Einstiege außerhalb von Routen aufrufen. */
  llmModule: Record<string, string[]>;
  /** Zusätzliche Aufrufe, die einen LLM-Aufruf auslösen (z. B. injizierte Abhängigkeit `d.erkenne`). */
  llmAufrufeZusaetzlich?: string[];
  /** Namen der Messfunktionen (Default `messeKiVerbrauch`; lokale Hüllen wie `messe` ergänzen). */
  kiMesser?: string[];
  /** Funktionen aus anderen Dateien, die nachweislich auditieren (z. B. `d.verteile`). */
  auditHelfer?: string[];
  /** Regex für vorgangsbezogene Pfade (Default `VORGANGS_PFAD`). */
  vorgangsPfad?: RegExp;
  /** Begründete Ausnahmen: Schlüssel `METHODE /pfad` → Begründung. */
  ausnahmen?: { audit?: Record<string, string>; ki?: Record<string, string>; einschraenkung?: Record<string, string> };
}

export interface PruefErgebnis {
  /** Geprüfte Einheiten (Routen bzw. Dateien). */
  geprueft: string[];
  /** Verstöße als `METHODE /pfad` bzw. Dateiname, jeweils mit Fundstelle im Text. */
  verstoesse: string[];
  /** Ausnahmen, die keinen Verstoß abdecken (veraltet oder falsch geschrieben). */
  ungenutzteAusnahmen: string[];
}

/** Routen-Dateien: explizit (`routenDateien`) oder alle Dateien im Routen-Ordner. */
function routenQuellen(k: KonformitaetsKonfig): Quelle[] {
  if (k.routenDateien) return k.routenDateien.map((datei) => ({ datei, ...lies(join(k.appDir, datei)) }));
  const ordner = k.routenOrdner ?? 'routes';
  return leseQuellen(join(k.appDir, ordner)).map((q) => ({ ...q, datei: `${ordner}/${q.datei}` }));
}

function routenDerApp(k: KonformitaetsKonfig): RoutenHandler[] {
  return routenQuellen(k).flatMap((q) => findeRouten(q.src, q.datei, q.code));
}

function funktionenJeDatei(k: KonformitaetsKonfig): Map<string, Funktion[]> {
  return new Map(routenQuellen(k).map((q) => [q.datei, findeFunktionen(q.src, q.code)]));
}

function ergebnis(geprueft: string[], roh: Array<{ schluessel: string; text: string }>, ausnahmen: Record<string, string> = {}): PruefErgebnis {
  const verstoesse = roh.filter((v) => !(v.schluessel in ausnahmen)).map((v) => v.text);
  const genutzt = new Set(roh.map((v) => v.schluessel));
  return { geprueft, verstoesse, ungenutzteAusnahmen: Object.keys(ausnahmen).filter((a) => !genutzt.has(a)) };
}

/** Schlüssel eines Verstoßes aus dem Verstoß-Text (`METHODE /pfad` vor dem ersten ` — `). */
export function schluesselVon(verstoss: string): string {
  return verstoss.split(' — ')[0]!;
}

/** Audit: jede direkt registrierte Schreibroute ruft `audit`/`auditUpdate` (oder einen auditierenden Helfer). */
export function pruefeAudit(k: KonformitaetsKonfig): PruefErgebnis {
  const fns = funktionenJeDatei(k);
  const routen = routenDerApp(k).filter((r) => SCHREIB_METHODEN.has(r.methode));
  const roh: Array<{ schluessel: string; text: string }> = [];
  for (const r of routen) {
    const auditierend = erreichend(fns.get(r.datei) ?? [], (c) => !!ruftEinenAuf(c, AUDIT_NAMEN, true));
    const ok = ruftEinenAuf(r.code, AUDIT_NAMEN, true)
      || ruftEinenAuf(r.code, auditierend)
      || ruftEinenAuf(r.code, k.auditHelfer ?? []);
    if (!ok) roh.push({ schluessel: r.schluessel, text: `${r.schluessel} — ${r.datei}:${r.zeile} ruft kein audit()` });
  }
  return ergebnis(routen.map((r) => r.schluessel), roh, k.ausnahmen?.audit);
}

/** Einschränkung (Art. 18): jede vorgangsbezogene Schreibroute prüft `denyIf…Eingeschraenkt`. */
export function pruefeEinschraenkung(k: KonformitaetsKonfig): PruefErgebnis {
  const re = k.vorgangsPfad ?? VORGANGS_PFAD;
  const fns = funktionenJeDatei(k);
  const routen = routenDerApp(k).filter((r) => SCHREIB_METHODEN.has(r.methode) && re.test(r.pfad));
  const roh: Array<{ schluessel: string; text: string }> = [];
  for (const r of routen) {
    const pruefend = erreichend(fns.get(r.datei) ?? [], (c) => !!ruftEinenAuf(c, GATE_NAMEN, true));
    if (!ruftEinenAuf(r.code, GATE_NAMEN, true) && !ruftEinenAuf(r.code, pruefend)) {
      roh.push({ schluessel: r.schluessel, text: `${r.schluessel} — ${r.datei}:${r.zeile} ohne Einschränkungs-Prüfung` });
    }
  }
  return ergebnis(routen.map((r) => r.schluessel), roh, k.ausnahmen?.einschraenkung);
}

/** Alle LLM-Einstiege der App (Basis + deklarierte Modul-Funktionen + Zusätze). */
export function llmEinstiege(k: KonformitaetsKonfig): string[] {
  return [...LLM_EINSTIEGE_BASIS, ...Object.values(k.llmModule).flat(), ...(k.llmAufrufeZusaetzlich ?? [])];
}

/**
 * Nicht-Routen-Dateien der App, die einen Plattform-LLM-Einstieg direkt aufrufen. Muss genau
 * den deklarierten `llmModule` entsprechen (neues LLM-Modul ⇒ bewusst deklarieren).
 */
export function findeLlmModule(k: KonformitaetsKonfig): string[] {
  const routen = `${k.routenOrdner ?? 'routes'}/`;
  return leseQuellen(k.appDir)
    .filter((q) => !q.datei.startsWith(routen))
    .filter((q) => ruftEinenAuf(q.code, LLM_EINSTIEGE_BASIS))
    .map((q) => q.datei);
}

/**
 * KI-Verbrauch:
 *  1. Jede Route, die einen LLM-Einstieg erreicht (direkt oder über eine Funktion derselben
 *     Datei), ruft im selben Handler eine Messfunktion auf.
 *  2. Außerhalb der Routen rufen nur die deklarierten LLM-Module LLM-Einstiege auf; jede andere
 *     Nicht-Routen-Datei, die eine LLM-Funktion der App aufruft, misst selbst.
 *  3. Die deklarierten LLM-Funktionen existieren als Export ihres Moduls.
 */
export function pruefeKiVerbrauch(k: KonformitaetsKonfig): PruefErgebnis {
  const messer = ['messeKiVerbrauch', ...(k.kiMesser ?? [])];
  const einstiege = llmEinstiege(k);
  const misst = (c: string) => !!ruftEinenAuf(c, messer, true);
  const fns = funktionenJeDatei(k);
  const roh: Array<{ schluessel: string; text: string }> = [];
  const geprueft: string[] = [];

  for (const r of routenDerApp(k)) {
    const huellen = erreichend(fns.get(r.datei) ?? [], (c) => !!ruftEinenAuf(c, einstiege), misst);
    const aufruf = ruftEinenAuf(r.code, einstiege) ?? ruftEinenAuf(r.code, huellen);
    if (!aufruf) continue;
    geprueft.push(r.schluessel);
    if (!misst(r.code)) roh.push({ schluessel: r.schluessel, text: `${r.schluessel} — ${r.datei}:${r.zeile} ruft ${aufruf}() ohne messeKiVerbrauch` });
  }

  const routenPraefix = `${k.routenOrdner ?? 'routes'}/`;
  const modulFunktionen = Object.values(k.llmModule).flat();
  for (const q of leseQuellen(k.appDir)) {
    if (q.datei.startsWith(routenPraefix) || q.datei in k.llmModule) continue;
    const code = q.code;
    const aufruf = ruftEinenAuf(code, LLM_EINSTIEGE_BASIS) ?? ruftEinenAuf(code, modulFunktionen);
    if (!aufruf) continue;
    geprueft.push(q.datei);
    if (!misst(code)) roh.push({ schluessel: q.datei, text: `${q.datei} — ruft ${aufruf}() außerhalb eines deklarierten LLM-Moduls ohne messeKiVerbrauch` });
  }

  // Lokale Mess-Hüllen müssen selbst messen.
  const alleFns = [...fns.values()].flat();
  for (const h of k.kiMesser ?? []) {
    const f = alleFns.filter((x) => x.name === h);
    if (!f.length || !f.every((x) => ruftAuf(x.code, 'messeKiVerbrauch', true))) {
      roh.push({ schluessel: h, text: `${h} — deklarierte Mess-Hülle fehlt oder ruft messeKiVerbrauch nicht auf` });
    }
  }

  for (const [modul, namen] of Object.entries(k.llmModule)) {
    const pfad = join(k.appDir, modul);
    const src = existsSync(pfad) ? readFileSync(pfad, 'utf8') : '';
    for (const n of namen) {
      if (!new RegExp(`export\\s+(?:async\\s+)?(?:function\\s*\\*?\\s*|const\\s+)${esc(n)}\\b`).test(src)) {
        roh.push({ schluessel: modul, text: `${modul} — deklarierte LLM-Funktion ${n} nicht exportiert` });
      }
    }
  }
  return ergebnis(geprueft, roh, k.ausnahmen?.ki);
}

/**
 * Apps importieren einander nicht: Fundstellen (`datei:zeile`) von Importen aus den Ordnern
 * `andere` (Geschwister unter `apps/`), Tests eingeschlossen. Gemeinsames gehört in den Kern
 * oder — zwischen genau diesen Apps — in einen eigenen Geschwister-Ordner wie `_vorrang`.
 */
export function fremdeAppImporte(appDir: string, andere: string[]): string[] {
  if (!andere.length) return [];
  const namen = andere.map(esc).join('|');
  const re = new RegExp(`(?:from\\s+|import\\(\\s*)['"](?:\\.\\.?/)*(?:apps/)?(?:${namen})(?:/[^'"]*)?['"]`);
  const alle = (dir: string, rel = ''): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) return alle(join(dir, e.name), r);
    return e.name.endsWith('.ts') ? [r] : [];
  });
  return alle(appDir).flatMap((datei) => readFileSync(join(appDir, datei), 'utf8').split('\n')
    .map((z, i) => (re.test(z) ? `${datei}:${i + 1}` : null))
    .filter((x): x is string => x !== null));
}

/**
 * Präzise Prüfung für Hooks: jeder Aufruf von `name` in `src` liegt innerhalb der Argumente
 * eines Messaufrufs (`messer(...)`). Für Kern-Fabriken, die App-Hooks gemessen aufrufen.
 */
export function aufrufeInnerhalb(src: string, name: string, messer = 'messeKiVerbrauch'): { gesamt: number; ausserhalb: number[] } {
  const code = ohneLiterale(src);
  const bereiche: Array<[number, number]> = [];
  for (const m of code.matchAll(new RegExp(`(?<![\\w$])(?:[\\w$]+\\.)*${esc(messer)}\\s*\\(`, 'g'))) {
    const auf = m.index! + m[0].length - 1;
    bereiche.push([auf, klammerEnde(code, auf)]);
  }
  const ausserhalb: number[] = [];
  let gesamt = 0;
  for (const m of code.matchAll(new RegExp(`(?<![\\w$])(?:[\\w$]+\\.)*${esc(name)}\\s*\\(`, 'g'))) {
    gesamt++;
    if (!bereiche.some(([a, b]) => m.index! > a && m.index! < b)) ausserhalb.push(zeileVon(code, m.index!));
  }
  return { gesamt, ausserhalb };
}
