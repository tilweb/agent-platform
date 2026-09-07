import type { ExtractionProject, SegmentInstance, TrainingExample } from '../learning/types';

export function validateSegmentPlan(project: ExtractionProject, input: unknown, pageCount: number): SegmentInstance[] {
  if (!Array.isArray(input) || !input.length) throw new Error('Mindestens ein Abschnitt ist erforderlich.');
  const counts: Record<string, number> = {};
  let next = 1;
  const result = input.map(value => {
    if (!value || typeof value !== 'object') throw new Error('Ungültiger Abschnitt.');
    const { type, pageFrom, pageTo } = value;
    if (typeof type !== 'string' || (!Object.hasOwn(project.segments ?? {}, type) && type !== 'leerseite')) throw new Error('Bitte jeder Seite einen bekannten Abschnittstyp zuordnen.');
    if (!Number.isInteger(pageFrom) || !Number.isInteger(pageTo) || pageFrom !== next || pageTo < pageFrom || pageTo > pageCount) throw new Error('Abschnitte müssen alle Seiten lückenlos, in Reihenfolge und ohne Überlappung abdecken.');
    next = pageTo + 1;
    counts[type] = (counts[type] ?? 0) + 1;
    if (type !== 'leerseite' && !project.segments![type]!.repeatable && counts[type]! > 1) throw new Error(`Abschnitt „${type}“ darf nur einmal vorkommen.`);
    return { type, pageFrom, pageTo, instance: counts[type]!, confidence: 1 };
  });
  if (next !== pageCount + 1) throw new Error('Nicht alle Originalseiten sind zugeordnet.');
  for (const [type, def] of Object.entries(project.segments ?? {})) if (def.required && !counts[type]) throw new Error(`Pflichtabschnitt „${def.label}“ fehlt.`);
  return result;
}

export function segmentIdentity(segment: SegmentInstance): string {
  return `${segment.type}:${segment.pageFrom}-${segment.pageTo}`;
}

export function segmentExamples(project: ExtractionProject, type: string, examples: TrainingExample[]): TrainingExample[] {
  const def = project.segments?.[type];
  if (!def) return [];
  return examples.filter(example => example.dataset?.purpose !== 'test').flatMap(example => {
    const raw = example.corrected_extraction[type];
    const values = def.repeatable ? (Array.isArray(raw) ? raw : []) : raw ? [raw] : [];
    return values.map((value, index) => {
      const key = def.repeatable ? `${type}[${index + 1}]` : type;
      const rawInitial = example.initial_extraction[type];
      const initial = (def.repeatable ? (Array.isArray(rawInitial) ? rawInitial[index] : undefined) : rawInitial) as Record<string, unknown> | undefined;
      const corrections = Object.entries(value as Record<string, unknown>).filter(([field, corrected]) => JSON.stringify(initial?.[field]) !== JSON.stringify(corrected)).map(([field, corrected]) => ({ field, was: initial?.[field], corrected_to: corrected }));
      return { ...example, id: `${example.id}:${key}`, document_text: example.dataset?.segment_contexts?.[key] ?? '',
        initial_extraction: initial ?? {}, corrected_extraction: value as Record<string, unknown>, corrections, confirmed_correct: corrections.length === 0,
        dataset: { ...example.dataset, purpose: example.dataset?.purpose ?? 'train' as const, visual: example.dataset?.segment_visual?.[key] } };
    });
  });
}
