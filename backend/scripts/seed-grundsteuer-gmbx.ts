/**
 * Seed: Extraktions-Profil „Grundsteuermessbescheide (GMBX)".
 *
 * Idempotent — legt das Profil nur an, wenn es noch nicht existiert. Schreibt in
 * dieselbe DB, die das Backend nutzt (Bun laedt .env automatisch).
 *
 * Ausfuehren (im backend/):
 *   /Users/andreasbachmann/.bun/bin/bun run scripts/seed-grundsteuer-gmbx.ts
 */
import { createProject, getProject, updateProject } from '../src/extraction/learning/projects';
import { GRUNDSTEUER_GMBX_SPEC, buildGrundsteuerGmbxProject } from '../src/extraction/templates/grundsteuer-gmbx';

const expectedId = buildGrundsteuerGmbxProject().id;

// Upsert: existiert das Profil, bringen wir Felder/Strategie/Pruefregeln auf den
// kanonischen Stand der Spec (z.B. neu hinzugekommene G3-count-Regel). Der
// Lern-Zustand (guidelines/examples) bleibt unangetastet.
const existing = await getProject(expectedId);
const project = existing
  ? await updateProject(expectedId, {
      description: GRUNDSTEUER_GMBX_SPEC.description,
      fields: GRUNDSTEUER_GMBX_SPEC.fields,
      extraction: GRUNDSTEUER_GMBX_SPEC.extraction,
      rules: GRUNDSTEUER_GMBX_SPEC.rules,
    })
  : await createProject(GRUNDSTEUER_GMBX_SPEC);

if (!project) throw new Error('Seed fehlgeschlagen (updateProject lieferte null).');
const listFields = Object.entries(project.fields).filter(([, f]) => f.type === 'list');
console.log(`Profil ${existing ? 'aktualisiert' : 'angelegt'}: „${project.name}" (id=${project.id})`);
console.log(`  Felder:     ${Object.keys(project.fields).length} (davon ${listFields.length} Liste)`);
console.log(`  Strategie:  ${project.extraction?.strategy}`);
console.log(`  Pruefregeln: ${(project.rules ?? []).map((r) => `${r.id} (${r.type})`).join(', ') || '—'}`);
process.exit(0);
