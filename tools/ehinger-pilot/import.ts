/**
 * Legt die vier Pilot-Projekte aus `projects/*.json` an (idempotent: vorhandene
 * werden aktualisiert). Nutzt dieselben CRUD-Funktionen wie die UI.
 *
 *   /Users/andreasbachmann/.bun/bin/bun run ../tools/ehinger-pilot/import.ts
 *   /Users/andreasbachmann/.bun/bin/bun run ../tools/ehinger-pilot/import.ts --delete
 */

import { readdir, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { createProject, deleteProject, getAllProjects, updateProject } from '../../backend/src/extraction/learning/projects';
import { validateProjectFields } from '../../backend/src/extraction/learning/validators';

const DIR = resolve(import.meta.dir, 'projects');

async function main() {
  const remove = process.argv.includes('--delete');

  if (remove) {
    for (const p of await getAllProjects()) {
      if (!p.id.startsWith('ehinger-pilot-')) continue;
      await deleteProject(p.id);
      console.log(`geloescht: ${p.id}`);
    }
    process.exit(0);
  }

  const existing = new Map((await getAllProjects()).map((p) => [p.id, p]));

  for (const file of (await readdir(DIR)).filter((f) => f.endsWith('.json')).sort()) {
    const def = JSON.parse(await readFile(join(DIR, file), 'utf-8'));
    const fieldError = validateProjectFields(def.fields);
    if (fieldError) {
      console.error(`${file}: ${fieldError}`);
      process.exit(1);
    }

    const id = def.name
      .toLowerCase()
      .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    if (existing.has(id)) {
      await updateProject(id, {
        name: def.name,
        description: def.description,
        fields: def.fields,
        instructions: def.instructions,
        extraction: def.extraction,
      });
      console.log(`aktualisiert: ${id} (${Object.keys(def.fields).length} Felder)`);
    } else {
      const created = await createProject(def);
      console.log(`angelegt: ${created.id} (${Object.keys(def.fields).length} Felder)`);
    }
  }
  process.exit(0);
}

void main();
