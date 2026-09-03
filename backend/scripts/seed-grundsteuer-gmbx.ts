/**
 * Seed: Extraktions-Profil „Grundsteuermessbescheide (GMBX)".
 *
 * Idempotent — legt das Profil nur an, wenn es noch nicht existiert. Schreibt in
 * dieselbe DB, die das Backend nutzt (Bun laedt .env automatisch).
 *
 * Ausfuehren (im backend/):
 *   /Users/andreasbachmann/.bun/bin/bun run scripts/seed-grundsteuer-gmbx.ts
 */
import { createProject, getProject } from '../src/extraction/learning/projects';
import { GRUNDSTEUER_GMBX_SPEC, buildGrundsteuerGmbxProject } from '../src/extraction/templates/grundsteuer-gmbx';

const expectedId = buildGrundsteuerGmbxProject().id;

const existing = await getProject(expectedId);
if (existing) {
  console.log(`Profil „${existing.name}" existiert bereits (id=${existing.id}) — nichts zu tun.`);
  process.exit(0);
}

const project = await createProject(GRUNDSTEUER_GMBX_SPEC);
const listFields = Object.entries(project.fields).filter(([, f]) => f.type === 'list');
console.log(`Profil angelegt: „${project.name}" (id=${project.id})`);
console.log(`  Felder:        ${Object.keys(project.fields).length} (davon ${listFields.length} Liste)`);
console.log(`  Strategie:     ${project.extraction?.strategy}`);
process.exit(0);
