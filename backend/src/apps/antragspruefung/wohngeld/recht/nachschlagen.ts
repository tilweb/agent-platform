/**
 * Gesetz nachschlagen — findet die passende Stelle im amtlichen Wortlaut (WoGG, WoGV, SGB I §§ 60–67).
 *
 * Grundsatz: Die Antwort besteht AUSSCHLIESSLICH aus Gesetzesstellen im Wortlaut. Das Modell
 * formuliert nichts; es wählt nur aus einer deterministischen Vorauswahl die passenden Absätze
 * (IDs) aus. Angezeigt wird immer der Text aus dem Korpus, nie Text aus der Modellantwort.
 *
 * 1. Direkte Abfrage („§ 66 SGB I", „§ 14 Abs. 2") ⇒ ohne Modell.
 * 2. Vorauswahl: BM25-ähnliche Volltextsuche + Überschrift + alltagssprachliche Suchbegriffe
 *    (aus dem kuratierten C2-Korpus je Paragraph) + Paragraphen-/Gesetzesnennung.
 * 3. Auswahl: Modell gibt nur IDs aus der Vorauswahl zurück (JSON-Schema mit Enum).
 *    Fällt das Modell aus ⇒ beste Treffer der Vorauswahl, als solche gekennzeichnet.
 *
 * Spec: docs/wohngeld-gesetzes-nachschlagen-spec-2026-09-24.md
 */
import { RECHT_KORPUS } from './corpus';
import { ZUSATZ_SUCHBEGRIFFE } from './suchbegriffe';
import { fundstelle, type GesetzAbsatz } from './gesetz-parser';
import { GESETZ_ABSAETZE, GESETZ_QUELLEN } from './gesetze.generated';
import { erkannteParagraphen, tokenize } from './retrieval';
import type { ChatFundstelle } from '../types';

// ── Normalisierung ───────────────────────────────────────────────────────────

/** Einfache Stammform für deutsche Wörter (reicht für Einkommen/Einkommens/Einkünfte-Nähe nicht, aber für Flexion). */
export function stamm(t: string): string {
  if (t.length <= 5) return t;
  return t.replace(/(ungen|ung|heiten|heit|keiten|keit|en|er|es|em|e|n|s)$/, '');
}
const stamme = (text: string) => tokenize(text).map(stamm).filter((t) => t.length >= 2);

const STAND = new Map(GESETZ_QUELLEN.map((q) => [q.gesetz, q.stand]));

// ── Index ────────────────────────────────────────────────────────────────────

interface IndexEintrag {
  a: GesetzAbsatz;
  tf: Map<string, number>;
  laenge: number;
  titel: Set<string>;
  tags: Set<string>;
  nr: string;
}

/** Alltagssprachliche Suchbegriffe aus dem kuratierten Korpus (C2), je Gesetz + Paragraph. */
function tagsJeParagraph(): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const c of RECHT_KORPUS) {
    const k = `${c.gesetz}|${c.paragraph}`;
    const s = m.get(k) ?? new Set<string>();
    for (const t of c.tags.flatMap(stamme)) s.add(t);
    m.set(k, s);
  }
  for (const [k, begriffe] of Object.entries(ZUSATZ_SUCHBEGRIFFE)) {
    const s = m.get(k) ?? new Set<string>();
    for (const t of begriffe.flatMap(stamme)) s.add(t);
    m.set(k, s);
  }
  return m;
}

let INDEX: { eintraege: IndexEintrag[]; df: Map<string, number>; avgLaenge: number } | null = null;
function index() {
  if (INDEX) return INDEX;
  const tags = tagsJeParagraph();
  const df = new Map<string, number>();
  const eintraege = GESETZ_ABSAETZE.map((a) => {
    const tokens = stamme(a.text);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    return {
      a, tf, laenge: tokens.length,
      titel: new Set(stamme(a.titel)),
      tags: tags.get(`${a.gesetz}|${a.paragraph}`) ?? new Set<string>(),
      nr: a.paragraph.replace(/^§\s*/, '').toLowerCase(),
    };
  });
  INDEX = { eintraege, df, avgLaenge: eintraege.reduce((s, e) => s + e.laenge, 0) / Math.max(1, eintraege.length) };
  return INDEX;
}

// ── Erkennung von Gesetz, Paragraph, Absatz in der Frage ─────────────────────

export function genanntesGesetz(frage: string): string | undefined {
  const f = frage.toLowerCase();
  if (/\bwogv\b|wohngeldverordnung/.test(f)) return 'WoGV';
  if (/\bsgb\s*(i|1)\b|sozialgesetzbuch\s*(i|1|erstes)\b/.test(f)) return 'SGB I';
  if (/\bwogg\b|wohngeldgesetz/.test(f)) return 'WoGG';
  return undefined;
}

/** Paragraphen inkl. Buchstabe („§ 17a"), klein geschrieben. */
function genannteParagraphen(frage: string): Set<string> {
  const out = new Set<string>([...erkannteParagraphen(frage)].map(String));
  for (const m of frage.toLowerCase().matchAll(/§+\s*(\d{1,3}[a-z])\b/g)) out.add(m[1]!);
  return out;
}

// ── Vorauswahl ───────────────────────────────────────────────────────────────

export interface Kandidat { absatz: GesetzAbsatz; score: number }

const K1 = 1.2, B = 0.75;

/**
 * Zusammengesetzte Wörter der Frage, die so im Gesetz nicht vorkommen („Vermögensgrenze",
 * „Unterhaltszahlungen"), um enthaltene Wörter des Gesetzes ergänzen („vermoeg…", „unterhalt").
 */
export function erweitere(q: string[], vokabular: Map<string, number>): string[] {
  const out = new Set(q);
  for (const t of q) {
    if (t.length < 8 || vokabular.has(t)) continue;
    for (const v of vokabular.keys()) {
      if (v.length >= 5 && v.length < t.length && (t.startsWith(v) || t.endsWith(v))) out.add(v);
    }
  }
  return [...out];
}

/** Deterministische Vorauswahl (höchstens k Absätze, Score > 0). */
export function vorauswahl(frage: string, k = 15): Kandidat[] {
  const { eintraege, df, avgLaenge } = index();
  const n = eintraege.length;
  const q = erweitere([...new Set(stamme(frage))], df);
  const paras = genannteParagraphen(frage);
  const gesetz = genanntesGesetz(frage);

  const kandidaten = eintraege.map((e) => {
    let score = 0;
    for (const t of q) {
      const f = e.tf.get(t) ?? 0;
      if (f) {
        const idf = Math.log(1 + (n - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
        score += idf * (f * (K1 + 1)) / (f + K1 * (1 - B + B * (e.laenge / avgLaenge)));
      }
      if (e.titel.has(t)) score += 3;
      if (e.tags.has(t)) score += 2;
    }
    if (paras.has(e.nr)) score += gesetz ? (e.a.gesetz === gesetz ? 30 : 0) : (e.a.gesetz === 'WoGG' ? 25 : 15);
    if (gesetz && e.a.gesetz === gesetz) score += 2;
    return { absatz: e.a, score };
  }).filter((x) => x.score > 0);

  kandidaten.sort((a, b) => b.score - a.score || a.absatz.id.localeCompare(b.absatz.id));
  return kandidaten.slice(0, k);
}

/** Suchbegriffe (Stämme ≥ 4 Zeichen) für die Hervorhebung im Wortlaut. */
export function suchbegriffe(frage: string): string[] {
  return [...new Set(stamme(frage).filter((t) => t.length >= 4 && !/^\d+$/.test(t)))];
}

// ── Direkte Abfrage ──────────────────────────────────────────────────────────

/**
 * „§ 66 SGB I", „zeig § 14 Abs. 2 WoGG", „Paragraph 7" ⇒ die Stelle selbst, ohne Modell.
 * Nur, wenn die Frage im Kern eine Fundstelle ist (kein weiterer Inhalt).
 */
export function direkteAbfrage(frage: string): GesetzAbsatz[] | null {
  const f = frage.trim().toLowerCase().replace(/[?.!]+$/, '');
  const m = f.match(/^(?:zeig\w*|was steht in|wortlaut(?: von)?|text(?: von)?)?\s*(?:§+|paragraph|par\.?)\s*(\d{1,3}[a-z]?)(?:\s*abs(?:atz|\.)?\s*(\d{1,2}[a-z]?))?\s*(wogg|wogv|sgb\s*(?:i|1)|wohngeldgesetz|wohngeldverordnung)?$/);
  if (!m) return null;
  const nr = m[1]!;
  const abs = m[2];
  const gesetz = m[3] ? genanntesGesetz(m[3]) : 'WoGG';
  const treffer = GESETZ_ABSAETZE.filter((a) => a.gesetz === gesetz && a.paragraph.toLowerCase() === `§ ${nr}`
    && (!abs || a.absatz === `Abs. ${abs}`));
  return treffer.length ? treffer : null;
}

// ── Auswahl durch das Modell ─────────────────────────────────────────────────

/** Ruft das Modell auf und liefert dessen Rohantwort (injizierbar für Tests). */
export type ModellAufruf = (system: string, user: string, schema: Record<string, unknown>) => Promise<string>;

export const AUSWAHL_SYSTEM = `Du hilfst der Wohngeld-Sachbearbeitung, die passende Stelle im Gesetz zu finden.
Du bekommst eine Frage und nummerierte Auszüge aus WoGG, WoGV und SGB I, jeweils mit ID in eckigen Klammern.
Wähle die Auszüge, die die Frage unmittelbar regeln — höchstens 4, der passendste zuerst.
Du schreibst KEINEN eigenen Text, keine Erklärung, keine Zusammenfassung und keine Auslegung.
Antworte ausschließlich mit JSON: {"ids": ["…"], "keine_passend": false}.
Passt kein Auszug, antworte {"ids": [], "keine_passend": true}. Verwende nur IDs aus der Liste.`;

export function auswahlPrompt(frage: string, kandidaten: Kandidat[]): string {
  const liste = kandidaten.map((k) => {
    const a = k.absatz;
    const text = a.text.length > 900 ? `${a.text.slice(0, 900)} …` : a.text;
    return `[${a.id}] ${fundstelle(a)} — ${a.titel}\n${text}`;
  }).join('\n\n');
  return `Frage: ${frage}\n\nAuszüge:\n\n${liste}`;
}

export function auswahlSchema(ids: string[]): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      ids: { type: 'array', items: { type: 'string', enum: ids }, maxItems: 4 },
      keine_passend: { type: 'boolean' },
    },
    required: ['ids', 'keine_passend'],
    additionalProperties: false,
  };
}

/** Modellantwort → gültige IDs (nur Kandidaten, dedupliziert, max. 4). `null` = nicht lesbar. */
export function leseAuswahl(roh: string, erlaubt: Set<string>): { ids: string[]; keine: boolean } | null {
  const s = roh.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = s.indexOf('{'), ende = s.lastIndexOf('}');
  if (start < 0 || ende <= start) return null;
  try {
    const j = JSON.parse(s.slice(start, ende + 1)) as { ids?: unknown; keine_passend?: unknown };
    const ids = [...new Set((Array.isArray(j.ids) ? j.ids : []).filter((x): x is string => typeof x === 'string' && erlaubt.has(x)))].slice(0, 4);
    return { ids, keine: j.keine_passend === true && ids.length === 0 };
  } catch {
    return null;
  }
}

// ── Ergebnis ─────────────────────────────────────────────────────────────────

export interface NachschlagErgebnis {
  fundstellen: ChatFundstelle[];
  auswahl: 'modell' | 'vorauswahl' | 'direkt' | 'keine';
  suchbegriffe: string[];
}

export function alsFundstelle(a: GesetzAbsatz): ChatFundstelle {
  return { id: a.id, gesetz: a.gesetz, paragraph: a.paragraph, ...(a.absatz ? { absatz: a.absatz } : {}), titel: a.titel, text: a.text, url: a.url, stand: STAND.get(a.gesetz) ?? '' };
}

/** Alle Absätze des Paragraphen einer Fundstelle (für „ganzen § anzeigen"). */
export function ganzerParagraph(id: string): ChatFundstelle[] {
  const a = GESETZ_ABSAETZE.find((x) => x.id === id);
  if (!a) return [];
  return GESETZ_ABSAETZE.filter((x) => x.gesetz === a.gesetz && x.paragraph === a.paragraph).map(alsFundstelle);
}

/** Gesetz nachschlagen: direkte Abfrage, sonst Vorauswahl + Auswahl durch das Modell (mit Rückfall). */
export async function schlageNach(frage: string, modell: ModellAufruf | null): Promise<NachschlagErgebnis> {
  const begriffe = suchbegriffe(frage);
  const direkt = direkteAbfrage(frage);
  if (direkt) return { fundstellen: direkt.map(alsFundstelle), auswahl: 'direkt', suchbegriffe: [] };

  const kandidaten = vorauswahl(frage);
  if (!kandidaten.length) return { fundstellen: [], auswahl: 'keine', suchbegriffe: begriffe };

  const rueckfall = (): NachschlagErgebnis => ({ fundstellen: kandidaten.slice(0, 3).map((k) => alsFundstelle(k.absatz)), auswahl: 'vorauswahl', suchbegriffe: begriffe });
  if (!modell) return rueckfall();

  const erlaubt = new Set(kandidaten.map((k) => k.absatz.id));
  try {
    const roh = await modell(AUSWAHL_SYSTEM, auswahlPrompt(frage, kandidaten), auswahlSchema([...erlaubt]));
    const r = leseAuswahl(roh, erlaubt);
    if (!r) return rueckfall();
    if (r.keine || !r.ids.length) return { fundstellen: [], auswahl: 'keine', suchbegriffe: begriffe };
    const byId = new Map(kandidaten.map((k) => [k.absatz.id, k.absatz]));
    return { fundstellen: r.ids.map((id) => alsFundstelle(byId.get(id)!)), auswahl: 'modell', suchbegriffe: begriffe };
  } catch (err) {
    console.warn('[wohngeld] Gesetzes-Auswahl durch das Modell fehlgeschlagen — Vorauswahl:', err instanceof Error ? err.message : err);
    return rueckfall();
  }
}

/** Kurze Zusammenfassung für den Verlauf (kein Inhalt, nur Fundstellen). */
export function ergebnisZeile(e: NachschlagErgebnis): string {
  if (!e.fundstellen.length) return 'Keine passende Stelle gefunden.';
  return e.fundstellen.map((f) => fundstelle(f)).join(' · ');
}
