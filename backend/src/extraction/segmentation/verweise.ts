/**
 * Segmenttypen mit Verweis auf eine bestehende Pipeline (Konzept DP-Produktmodell §6 Punkt 6).
 *
 * Ein Segmenttyp mit `profil` uebernimmt Felder und Anweisungen der verwiesenen
 * Pipeline. Aufgeloest wird beim Einfrieren (Snapshot) — der Lauf bleibt
 * reproduzierbar, der Snapshot-Hash enthaelt die aufgeloesten Felder.
 */

import type { ExtractionProject } from '../learning/types';

/** Prueft Verweise eines Profils (vor dem Speichern). Liefert eine deutsche Fehlermeldung oder null. */
export function pruefeSegmentVerweise(
  profilId: string | null,
  segments: ExtractionProject['segments'],
  finde: (id: string) => Pick<ExtractionProject, 'id' | 'segments'> | null | undefined,
): string | null {
  for (const [segId, def] of Object.entries(segments ?? {})) {
    if (!def.profil) continue;
    if (def.profil === profilId) return `Segment „${segId}": kann nicht auf das eigene Profil verweisen`;
    if (def.mode === 'classify-only') return `Segment „${segId}": classify-only-Segmente lesen keine Felder aus — Verweis auf ein Profil nicht möglich`;
    if (def.fields && Object.keys(def.fields).length) return `Segment „${segId}": entweder eigene Felder oder Verweis auf ein Profil, nicht beides`;
    const ziel = finde(def.profil);
    if (!ziel) return `Segment „${segId}": verwiesenes Profil „${def.profil}" nicht gefunden`;
    if (ziel.segments && Object.keys(ziel.segments).length) return `Segment „${segId}": verwiesenes Profil „${def.profil}" hat selbst Segmente — nur einfache Profile sind als Baustein möglich`;
  }
  return null;
}

/** Verweise aufloesen: Felder + Anweisungen der verwiesenen Pipeline in die Segmentdefinition kopieren. */
export function loeseSegmentVerweiseAuf(
  project: ExtractionProject,
  finde: (id: string) => Pick<ExtractionProject, 'fields' | 'instructions'> | null | undefined,
): ExtractionProject {
  if (!project.segments || !Object.values(project.segments).some((d) => d.profil)) return project;
  const segments: NonNullable<ExtractionProject['segments']> = {};
  for (const [segId, def] of Object.entries(project.segments)) {
    if (!def.profil) { segments[segId] = def; continue; }
    const ziel = finde(def.profil);
    segments[segId] = ziel
      ? { ...def, fields: structuredClone(ziel.fields), ...(ziel.instructions?.trim() ? { hinweise: ziel.instructions.trim() } : {}) }
      : def; // fehlendes Ziel: Segment bleibt ohne Felder → nur Beleg (wie classify-only), Pruefung meldet es beim Speichern
  }
  return { ...project, segments };
}
