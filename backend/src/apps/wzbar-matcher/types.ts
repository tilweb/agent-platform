/**
 * WZ-Branchen-Matcher Types
 */

export interface CatalogEntry {
  code: string;
  kurztext: string;
  langtext: string;
  validFrom: string | null;
  validTo: string | null;
}

export interface EmbeddingEntry {
  code: string;
  vector: number[];
}

export interface EmbeddingsIndex {
  model: string;
  dimensions: number;
  builtAt: string;
  inputHash: string;
  entries: EmbeddingEntry[];
}

export interface RetrievalHit {
  code: string;
  similarity: number;
}

export interface MatchCandidate {
  code: string;
  kurztext: string;
  langtext: string;
  confidence: number;
  reasoning: string;
}

export interface MatchResult {
  primary: MatchCandidate;
  alternatives: MatchCandidate[];
}

/**
 * Alias-Index (M4): zusaetzliche Embedding-Vektoren pro Code aus der
 * enrich-Haelfte der Destatis-Stichwoerter. Metadaten als JSON, Vektoren als
 * Float32-Binaerdatei (Reihenfolge = entries-Reihenfolge).
 */
export interface AliasMeta {
  model: string;
  dimensions: number;
  builtAt: string;
  sourceFile: string;
  entries: Array<{ text: string; codes: string[] }>;
}

export interface AliasIndex extends AliasMeta {
  /** Alle Vektoren konkateniert; Vektor i = vectors.subarray(i*dim, (i+1)*dim). */
  vectors: Float32Array;
}

export interface ActivityMatch {
  activity: string;
  /** Fachsprachliche Suchvarianten aus der Query-Expansion (M3), falls genutzt. */
  queryVariants?: string[];
  result: MatchResult;
  retrievalTopK: RetrievalHit[];
}

export interface MultiMatchResult {
  activities: ActivityMatch[];
}

export interface MatchRecord {
  /** sha256 des normalisierten inputText — Schluessel des Ergebnis-Caches. */
  inputHash?: string;
  /** Pipeline-Version beim Erzeugen; Cache-Treffer nur bei identischer Version. */
  pipelineVersion?: string;
  /** Transient (nicht persistiert): Ergebnis kam aus dem Cache. */
  cached?: boolean;
  id: string;
  createdAt: string;
  userId: string;
  inputText: string;
  result: MultiMatchResult;
  retrievalTopK: RetrievalHit[];
  llmModel: string;
  embeddingModel: string;
  durationMs: number;
}

export interface MatchRequest {
  inputText: string;
}

export interface StatusResponse {
  catalogSize: number;
  indexReady: boolean;
  embeddingModel: string | null;
  embeddingDimensions: number | null;
}
