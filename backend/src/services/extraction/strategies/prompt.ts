/**
 * Gemeinsamer Prompt-Helfer fuer alle Strategien.
 *
 * `profile.guidelines` ist ein optionales Freitext-Feld auf dem
 * `ExtractionProfile`. App-Adapter koennen darin zusaetzliche Instruktionen
 * transportieren — z.B. das Extraktions-Projekte-Feature rendert dort seine
 * gelernten Extraktionsregeln + Few-Shot-Beispiele hinein.
 *
 * Profile ohne `guidelines` (z.B. Vertragsmanagement) bleiben unveraendert —
 * der Hook ist damit backward-safe fuer bestehende Konsumenten.
 */

import type { ExtractionProfile } from '../../../extraction/types';

export function appendGuidelines(systemPrompt: string, profile: ExtractionProfile): string {
  if (profile.guidelines && profile.guidelines.trim()) {
    return `${systemPrompt}\n\n${profile.guidelines.trim()}`;
  }
  return systemPrompt;
}
