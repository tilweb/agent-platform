import { correctDate } from '../value-parsers';
import type { ExtractionProject, ProjectField, ProjectItemField, RuleIssue } from './types';

export const isEmpty = (v: unknown) => v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);
export const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Final business schema, independent of nullable LLM schemas and confidence. No mutation. */
export function validateProjectResult(project: ExtractionProject, data: Record<string, unknown>): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const issue = (path: string, message: string) => issues.push({
    rule_id: 'ergebnisschema', type: 'processing', severity: 'error', fields: [path], message: `${path}: ${message}`,
  });
  function fields(defs: Record<string, ProjectField | ProjectItemField>, value: unknown, prefix = '') {
    if (!isRecord(value)) { issue(prefix || 'Dokument', 'Feldobjekt erwartet'); return; }
    for (const id of Object.keys(value)) {
      if (!(id in defs)) issue(`${prefix}${id}`, 'Unbekanntes Feld');
    }
    for (const [id, def] of Object.entries(defs)) {
      const path = `${prefix}${id}`;
      const v = value[id];
      if (isEmpty(v)) {
        if (def.required) issue(path, 'Pflichtwert fehlt');
        // Optional null/empty string is permitted, but [] is not a scalar.
        if (v == null || (typeof v === 'string' && !v.trim()) || def.type === 'list') continue;
      }
      if (def.type === 'list') {
        if (!Array.isArray(v)) issue(path, 'Positionsliste erwartet');
        else v.forEach((row, index) => fields((def as ProjectField).item_fields ?? {}, row, `${path}[${index}].`));
      } else if (def.type === 'number' && (typeof v !== 'number' || !Number.isFinite(v))) issue(path, 'Endliche Zahl erwartet');
      else if (def.type === 'date' && (typeof v !== 'string' || correctDate(v) !== v)) issue(path, 'Gültiges Datum YYYY-MM-DD erwartet');
      else if (def.type === 'boolean' && typeof v !== 'boolean') issue(path, 'Ja/Nein-Wert erwartet');
      else if (def.type === 'text' && typeof v !== 'string') issue(path, 'Text erwartet');
    }
  }
  if (!project.segments || !Object.keys(project.segments).length) fields(project.fields, data);
  else {
    for (const id of Object.keys(data)) if (!(id in project.segments)) issue(id, 'Unbekanntes Segment');
    for (const [id, def] of Object.entries(project.segments)) {
      const value = data[id];
      if (isEmpty(value)) { if (def.required) issue(id, 'Pflichtsegment fehlt'); continue; }
      const instances = def.repeatable ? (Array.isArray(value) ? value : null) : [value];
      if (!instances) { issue(id, 'Liste von Segmentinstanzen erwartet'); continue; }
      instances.forEach((v, index) => {
        if (def.mode === 'classify-only' || !def.fields) return;
        fields(def.fields, v, `${id}${def.repeatable ? `[${index + 1}]` : ''}.`);
      });
    }
  }
  return issues;
}

/** A model's self-score is not a calibrated release probability (Package B). */
export function modelReviewIssue(strategy: string): RuleIssue[] {
  return strategy === 'template-labelmap' ? [] : [{
    rule_id: 'quellenpruefung', type: 'processing', severity: 'error', fields: [],
    message: 'Bitte gleiche alle Werte und die Vollständigkeit mit dem Original ab. Wenn alles stimmt, kannst du das Dokument als korrekt bestätigen und freigeben.',
  }];
}

/** Technical completion alone never authorizes downstream processing. */
export function isReleased(file: { status: string; reviewStatus?: string | null; strategy?: string | null; validations?: RuleIssue[] | null }): boolean {
  return file.status === 'completed' && ((file.reviewStatus === 'auto_ok' && file.strategy === 'template-labelmap') || file.reviewStatus === 'reviewed')
    && !(file.validations ?? []).some(i => i.severity === 'error' || i.status === 'not_evaluated');
}
