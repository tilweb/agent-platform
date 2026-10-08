/**
 * Basisprofil „Allgemein" (Konzept DP-Produktmodell §4) — eingebaut, nicht
 * loeschbar, nie Zuordnungskandidat. Faengt Dokumente auf, fuer die keine
 * Pipeline passt: Volltext je Seite + Kernwerte (Strategie `general-document`).
 */

import type { ExtractionProject, ProjectField } from './learning/types';

export const BASISPROFIL_ID = 'allgemein';

export const BASISPROFIL_FELDER: Record<string, ProjectField> = {
  dokumentart: { type: 'text', required: false, label: 'Dokumentart', description: 'Art des Dokuments in wenigen Worten, z. B. „Rechnung", „Bescheid", „Kündigungsschreiben"' },
  absender: { type: 'text', required: false, label: 'Absender' },
  empfaenger: { type: 'text', required: false, label: 'Empfänger' },
  datum: { type: 'date', required: false, label: 'Datum des Dokuments' },
  betreff: { type: 'text', required: false, label: 'Betreff' },
  referenznummern: { type: 'text', required: false, label: 'Referenznummern', description: 'Aktenzeichen, Kunden-, Rechnungs-, Vertragsnummern u. ä., durch „; " getrennt' },
  kurzinhalt: { type: 'text', required: false, label: 'Kurzinhalt', description: 'Worum es geht, in ein bis zwei Sätzen' },
};

export const istBasisprofil = (id: string | null | undefined) => id === BASISPROFIL_ID;

/** Zuordnungskandidaten: alle Pipelines ausser dem Basisprofil. */
export function zuordnungsKandidaten<T extends Pick<ExtractionProject, 'id'>>(projekte: T[]): T[] {
  return projekte.filter((p) => !istBasisprofil(p.id));
}

/** Basisprofil anlegen, falls es fehlt (idempotent). */
export async function stelleBasisprofilSicher(): Promise<void> {
  const { getProject, createProject } = await import('./learning/projects');
  if (await getProject(BASISPROFIL_ID)) return;
  const p = await createProject({
    name: 'Allgemein',
    description: 'Basisprofil für Dokumente ohne passende Pipeline: Volltext je Seite (auch Scans) und Kernwerte. Eingebaut, nicht löschbar.',
    fields: BASISPROFIL_FELDER,
    extraction: { strategy: 'general-document' },
  });
  if (p.id !== BASISPROFIL_ID) console.warn(`[dp] Basisprofil unter unerwarteter ID angelegt: ${p.id}`);
}
