/**
 * Export/Import von Extraktions-Projekten als portables Paket.
 *
 * Zweck: ein gut angelerntes, allgemeingültiges Projekt (Schema + Domänen-
 * Anweisungen + gelernte Guidelines, optional die Trainingsbeispiele) zwischen
 * Workplace-Instanzen weitergeben, ohne es in den Seed zu zwingen.
 *
 * Baut ausschließlich auf den bestehenden CRUD-Funktionen auf (getProject,
 * getExamples, createProject, updateProject, saveExample) — daher in beiden
 * Worktrees (Postgres/YAML) identisch, keine neue Storage-Divergenz.
 *
 * PII-Hinweis: Die rohen Trainingsbeispiele enthalten Originaldokument-Texte
 * (ggf. personenbezogene Daten). Sie wandern nur ins Paket, wenn beim Export
 * explizit `includeExamples` gesetzt ist. Die gelernten Guidelines sind die
 * generalisierte, PII-freie Essenz und immer enthalten.
 *
 * NICHT im Paket: das Webhook-Ziel (`webhook`). URL und Signaturschluessel sind
 * instanz-/kundenspezifische Betriebsgeheimnisse — eine weitergegebene Vorlage
 * wuerde sonst fremde Laeufe an den falschen Empfaenger melden.
 */

import type { ExtractionProject } from './types';
import { getProject } from './projects';
import { updateProject } from './projects';
import { createProject } from './projects';
import { getExamples, saveExample } from './examples';
import { validateProjectFields, validateProjectRules, validateProjectSegments } from './validators';

export const PROJECT_BUNDLE_FORMAT = 'kiworkplace-extraction-project';
export const PROJECT_BUNDLE_VERSION = 1;

interface BundleExample {
  source_filename: string;
  document_text: string;
  initial_extraction: Record<string, unknown>;
  corrected_extraction: Record<string, unknown>;
}

export interface ProjectBundle {
  format: typeof PROJECT_BUNDLE_FORMAT;
  version: number;
  exported_at: string;
  includes_examples: boolean;
  project: {
    name: string;
    description: string;
    fields: ExtractionProject['fields'];
    instructions?: string;
    guidelines: string;
    learning: ExtractionProject['learning'];
    extraction?: ExtractionProject['extraction'];
    /** Fachliche Pruefregeln (Welle 5) — PII-frei, daher immer im Paket. */
    rules?: ExtractionProject['rules'];
    /** Segmenttypen (Welle 10) — Beschreibungen + Feldsaetze, PII-frei. */
    segments?: ExtractionProject['segments'];
  };
  examples: BundleExample[];
}

/** Slug aus dem Namen — identisch zur ID-Vergabe in createProject(). */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Schnürt ein portables Paket aus einem Projekt. `includeExamples` entscheidet,
 * ob die rohen Trainingsbeispiele (PII!) mitgehen.
 */
export async function exportProject(
  projectId: string,
  includeExamples: boolean,
): Promise<ProjectBundle | null> {
  const project = await getProject(projectId);
  if (!project) return null;

  let examples: BundleExample[] = [];
  if (includeExamples) {
    const all = await getExamples(projectId);
    examples = all.map((e) => ({
      source_filename: e.source_filename,
      document_text: e.document_text,
      initial_extraction: e.initial_extraction,
      corrected_extraction: e.corrected_extraction,
    }));
  }

  return {
    format: PROJECT_BUNDLE_FORMAT,
    version: PROJECT_BUNDLE_VERSION,
    exported_at: new Date().toISOString(),
    includes_examples: includeExamples,
    project: {
      name: project.name,
      description: project.description,
      fields: project.fields,
      instructions: project.instructions,
      guidelines: project.guidelines,
      learning: project.learning,
      extraction: project.extraction,
      rules: project.rules,
      segments: project.segments,
    },
    examples,
  };
}

/** Findet einen freien Projektnamen (Slug noch nicht vergeben). */
async function uniqueName(baseName: string): Promise<string> {
  if (!(await getProject(slugify(baseName)))) return baseName;
  const candidate = `${baseName} (Import)`;
  if (!(await getProject(slugify(candidate)))) return candidate;
  for (let n = 2; n < 100; n += 1) {
    const c = `${baseName} (Import ${n})`;
    if (!(await getProject(slugify(c)))) return c;
  }
  // Fallback: sehr unwahrscheinlich
  return `${baseName} (Import ${Date.now().toString(36)})`;
}

function validateBundle(bundle: unknown): asserts bundle is ProjectBundle {
  const b = bundle as Partial<ProjectBundle>;
  if (!b || typeof b !== 'object') throw new Error('Ungültiges Paket (kein Objekt).');
  if (b.format !== PROJECT_BUNDLE_FORMAT) throw new Error('Unbekanntes Dateiformat — kein Extraktionsprojekt-Paket.');
  if (typeof b.version !== 'number' || b.version > PROJECT_BUNDLE_VERSION) {
    throw new Error(`Nicht unterstützte Paket-Version (${String(b.version)}).`);
  }
  if (!b.project || typeof b.project.name !== 'string' || !b.project.name.trim()) {
    throw new Error('Paket enthält keinen Profilnamen.');
  }
  // Segment-Profile (Welle 10) tragen ihre Felder IN den Segmenten —
  // project.fields darf dann leer sein.
  const hasSegments = !!b.project.segments && Object.keys(b.project.segments).length > 0;
  if (!hasSegments && (!b.project.fields || Object.keys(b.project.fields).length === 0)) {
    throw new Error('Paket enthält keine Felder.');
  }
  if (!b.project.fields || typeof b.project.fields !== 'object') {
    throw new Error('Paket enthält keine gültige Feld-Struktur.');
  }
  // Strukturelle Feld-Validierung (inkl. Listen-Felder) — defensiv gegen fremde Bundles.
  const fieldError = validateProjectFields(b.project.fields);
  if (fieldError) throw new Error(`Ungültige Felder im Paket: ${fieldError}`);
  // Pruefregeln referenzieren Feld-IDs — ein fremdes Bundle kann inkonsistent sein.
  const ruleError = validateProjectRules(b.project.fields, b.project.rules);
  if (ruleError) throw new Error(`Ungültige Prüfregeln im Paket: ${ruleError}`);
  // Segmenttypen (Welle 10) — additiv-optional, alte Pakete haben das Feld nicht.
  const segmentError = validateProjectSegments(b.project.segments);
  if (segmentError) throw new Error(`Ungültige Segmente im Paket: ${segmentError}`);
}

/**
 * Importiert ein Paket als IMMER NEUES Projekt (frische ID; Name bei Kollision
 * mit „(Import)"-Suffix). Stellt Guidelines + Lern-Metadaten wieder her und legt
 * — falls enthalten — die Trainingsbeispiele an.
 */
export async function importProject(bundle: unknown): Promise<ExtractionProject> {
  validateBundle(bundle);
  const src = bundle.project;

  const name = await uniqueName(src.name.trim());
  const created = await createProject({
    name,
    description: src.description || '',
    fields: src.fields,
    instructions: src.instructions,
    extraction: src.extraction,
    rules: src.rules,
    segments: src.segments,
  });

  // Trainingsbeispiele (optional) anlegen.
  const hasExamples = bundle.includes_examples && Array.isArray(bundle.examples) && bundle.examples.length > 0;
  if (hasExamples) {
    for (const ex of bundle.examples) {
      try {
        await saveExample(created.id, {
          source_filename: ex.source_filename || 'import',
          document_text: ex.document_text || '',
          initial_extraction: ex.initial_extraction || {},
          corrected_extraction: ex.corrected_extraction || {},
        });
      } catch (err) {
        console.error('[transfer] saveExample beim Import fehlgeschlagen:', err instanceof Error ? err.message : err);
      }
    }
  }

  // Gelernte Daten wiederherstellen (NACH den Beispielen, damit die Counts stimmen).
  const learning = {
    total_examples: hasExamples ? bundle.examples.length : 0,
    accuracy_estimate: hasExamples ? (src.learning?.accuracy_estimate ?? 0) : 0,
    guideline_version: src.learning?.guideline_version ?? (src.guidelines ? 1 : 0),
  };
  await updateProject(created.id, {
    guidelines: src.guidelines || '',
    learning,
  });

  const final = await getProject(created.id);
  return final ?? created;
}
