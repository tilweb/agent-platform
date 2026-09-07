import type { ExtractionProject, ProjectField } from './types';

export function ruleFields(project: Pick<ExtractionProject, 'fields' | 'segments'>): Record<string, ProjectField> {
  if (!project.segments || !Object.keys(project.segments).length) return project.fields;
  const result: Record<string, ProjectField> = {};
  for (const [type, def] of Object.entries(project.segments)) {
    if (def.repeatable) result[type] = { type: 'list', label: def.label, required: !!def.required,
      item_fields: Object.fromEntries(Object.entries(def.fields ?? {}).filter(([, f]) => f.type !== 'list')) as any };
    for (const [id, field] of Object.entries(def.fields ?? {})) result[`${type}.${id}`] = { ...field, label: `${def.label} · ${field.label}` };
  }
  return result;
}

export function ruleData(project: ExtractionProject, data: Record<string, unknown>): Record<string, unknown> {
  if (!project.segments) return data;
  const result = { ...data };
  for (const [type, def] of Object.entries(project.segments)) for (const id of Object.keys(def.fields ?? {})) {
    const raw = data[type];
    result[`${type}.${id}`] = def.repeatable
      ? (Array.isArray(raw) ? raw.map(row => row?.[id]) : undefined)
      : (raw as Record<string, unknown> | undefined)?.[id];
  }
  return result;
}
