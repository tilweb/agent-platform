/**
 * Podcast-Repurposing — Typen (DTOs ergänzend zum Drizzle-Schema).
 */

export type EpisodeStatus =
  | 'uploaded'
  | 'extracting_audio'
  | 'transcribing'
  | 'generating'
  | 'done'
  | 'failed';

export interface PipelineStep {
  id: string;                 // 'extract' | 'transcribe' | 'generate_text' | 'generate_visuals'
  name: string;               // Anzeige-Label
  status: 'pending' | 'running' | 'done' | 'failed';
  error?: string;
}

export const PIPELINE_STEPS: Array<{ id: string; name: string }> = [
  { id: 'extract', name: 'Audio extrahieren' },
  { id: 'transcribe', name: 'Transkribieren' },
  { id: 'generate_text', name: 'Texte generieren' },
  { id: 'generate_visuals', name: 'Visuals generieren' },
];

export interface OutputFields {
  hashtags?: string[];
  cta?: string;
  subject?: string;
}
