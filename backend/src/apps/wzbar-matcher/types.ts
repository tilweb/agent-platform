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

export interface MatchRecord {
  id: string;
  createdAt: string;
  userId: string;
  inputText: string;
  result: MatchResult;
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
