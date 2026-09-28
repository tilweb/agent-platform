/**
 * Recht-Retrieval (C2) — deterministische, testbare Suche im statischen Korpus.
 *
 * Bewusst KEIN Embedding/kein externer Call: reine, IO-freie Token-Overlap-
 * Bewertung mit Feld-Gewichtung (tags > titel > text) plus starkem Boost, wenn
 * die Frage einen Paragraphen explizit nennt („§ 14", „Paragraph 14"). Damit ist
 * das Retrieval reproduzierbar und ohne DB unit-testbar.
 */
import { RECHT_KORPUS, RECHT_KORPUS_BY_ID, type RechtChunk } from './corpus';

// ── Normalisierung ──────────────────────────────────────────────────────────

/** Umlaute/ß entschärfen, lowercase. */
function foldUmlauts(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

/** Deutsche Stopwords (klein gehalten — nur wirklich bedeutungsarme Wörter). */
const STOPWORDS = new Set(
  [
    'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einen', 'einem', 'eines',
    'und', 'oder', 'aber', 'wenn', 'weil', 'dass', 'als', 'wie', 'wo', 'wann', 'was', 'wer', 'wen',
    'ist', 'sind', 'war', 'waren', 'sein', 'wird', 'werden', 'wurde', 'hat', 'haben', 'habe', 'hatte',
    'kann', 'koennen', 'muss', 'muessen', 'darf', 'duerfen', 'soll', 'sollen', 'wird',
    'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'man', 'mich', 'mir', 'sich',
    'in', 'im', 'an', 'am', 'auf', 'aus', 'bei', 'mit', 'nach', 'von', 'vom', 'vor', 'zu', 'zum', 'zur',
    'ueber', 'unter', 'fuer', 'gegen', 'ohne', 'um', 'durch', 'per', 'ab',
    'nicht', 'kein', 'keine', 'auch', 'noch', 'nur', 'schon', 'sehr', 'mehr', 'viel', 'so', 'dann',
    'diese', 'dieser', 'dieses', 'denen', 'dessen', 'welche', 'welcher', 'welches',
    'meine', 'mein', 'sein', 'seine', 'ihre', 'ihren', 'unser',
    // Domänen-Stopwords: in Wohngeld-Fragen allgegenwärtig → nicht trennscharf.
    'wohngeld', 'bekommt', 'bekommen', 'bekomme', 'gibt', 'hoch', 'frage',
    'bitte', 'erklaere', 'sage', 'nenne', 'gilt', 'zaehlt', 'zaehlen',
  ].map(foldUmlauts),
);

/** Zerlegt Text in normalisierte, sinntragende Tokens (ohne Stopwords). */
export function tokenize(text: string): string[] {
  const folded = foldUmlauts(text);
  const raw = folded.split(/[^a-z0-9]+/).filter(Boolean);
  return raw.filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

// ── Paragraphen-Erkennung in der Frage ──────────────────────────────────────

/**
 * Findet explizit genannte Paragraphen-Nummern in der Frage.
 * Erkennt „§14", „§ 14", „paragraph 14", „par 14", „§§ 7 und 8".
 */
export function erkannteParagraphen(frage: string): Set<number> {
  const found = new Set<number>();
  const lower = frage.toLowerCase();
  const re = /(?:§+\s*|paragraph(?:en)?\s+|par\.?\s+)(\d{1,3})(?:\s*(?:und|,|bis)\s*(\d{1,3}))*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lower)) !== null) {
    // Alle Zahlen im Treffer einsammeln (deckt „§§ 7 und 8" ab).
    const nums = m[0].match(/\d{1,3}/g) ?? [];
    for (const n of nums) found.add(parseInt(n, 10));
  }
  return found;
}

/** Extrahiert die Paragraphen-Nummer eines Chunks (z. B. '§ 14' → 14). */
function chunkParagraphNr(chunk: RechtChunk): number | null {
  const m = chunk.paragraph.match(/(\d{1,3})/);
  return m ? parseInt(m[1]!, 10) : null;
}

// ── Scoring ──────────────────────────────────────────────────────────────────

const GEWICHT_TAG = 5; // Treffer in tags (alltagssprachliche Synonyme) — hoch
const GEWICHT_TITEL = 3; // Treffer in der amtlichen Überschrift
const GEWICHT_TEXT = 1; // Treffer im Gesetzestext
const BOOST_PARAGRAPH = 20; // Frage nennt genau diesen Paragraphen

export interface RechtTreffer {
  chunk: RechtChunk;
  score: number;
}

/**
 * Berechnet den Score eines Chunks gegen die (bereits tokenisierte) Frage.
 * Exportiert für Tests.
 */
export function scoreChunk(chunk: RechtChunk, frageTokens: string[], nannteParagraphen: Set<number>): number {
  if (frageTokens.length === 0 && nannteParagraphen.size === 0) return 0;

  const tagTokens = new Set(chunk.tags.flatMap((t) => tokenize(t)));
  const titelTokens = new Set(tokenize(chunk.titel));
  const textTokens = new Set(tokenize(chunk.text));

  let score = 0;
  // Jedes eindeutige Frage-Token nur einmal werten (kein Häufigkeits-Bias).
  for (const token of new Set(frageTokens)) {
    if (tagTokens.has(token)) score += GEWICHT_TAG;
    else if (titelTokens.has(token)) score += GEWICHT_TITEL;
    else if (textTokens.has(token)) score += GEWICHT_TEXT;
  }

  // Starker Boost, wenn die Frage genau diesen Paragraphen erwähnt.
  const nr = chunkParagraphNr(chunk);
  if (nr !== null && nannteParagraphen.has(nr)) score += BOOST_PARAGRAPH;

  return score;
}

/**
 * Deterministische Suche im Rechts-Korpus. Gibt die Top-k Chunks (Score > 0)
 * absteigend nach Score zurück. Rein, keine IO.
 */
export function sucheRecht(frage: string, k = 4): RechtChunk[] {
  const frageTokens = tokenize(frage);
  const nannteParagraphen = erkannteParagraphen(frage);

  const treffer: RechtTreffer[] = RECHT_KORPUS
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, frageTokens, nannteParagraphen) }))
    .filter((t) => t.score > 0);

  // Stabile Sortierung: Score desc, bei Gleichstand nach Korpus-Reihenfolge (id).
  treffer.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.chunk.id.localeCompare(b.chunk.id);
  });

  return treffer.slice(0, k).map((t) => t.chunk);
}

/** Auflösung einer Chunk-ID → RechtChunk (für Quellen-Marker im Chat). */
export function rechtChunkById(id: string): RechtChunk | undefined {
  return RECHT_KORPUS_BY_ID.get(id);
}
