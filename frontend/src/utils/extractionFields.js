export function fieldSlug(label) {
  return String(label || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function fieldsToArray(fields) {
  return Object.entries(fields || {}).map(([id, field]) => ({ ...structuredClone(field), id,
    label: field.label || id, description: field.description || '',
    ...(field.type === 'list' ? { item_fields: fieldsToArray(field.item_fields) } : {}),
  }));
}

export function fieldsToObject(fields) {
  const result = {};
  for (const field of fields || []) {
    if (!field.label?.trim()) throw new Error('Jedes Feld braucht eine Bezeichnung. Entferne nicht benötigte leere Felder.');
    const id = field.id || fieldSlug(field.label);
    if (!/^[a-zA-Z0-9_]+$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id)) throw new Error(`Ungültige Feld-ID „${id}“. Bitte Buchstaben, Ziffern und Unterstriche verwenden.`);
    if (Object.hasOwn(result, id)) throw new Error(`Feld-ID „${id}“ ist doppelt vergeben. Bitte eine eindeutige ID wählen.`);
    const { id: _id, item_fields, ...definition } = field;
    if (!definition.description) delete definition.description;
    result[id] = { ...definition, ...(field.type === 'list' ? { item_fields: fieldsToObject(item_fields) } : {}) };
    if (field.type === 'list' && !Object.keys(result[id].item_fields).length) throw new Error(`Liste „${field.label}“ benötigt mindestens eine Spalte.`);
  }
  return result;
}

export function validateEditorFields(fields) {
  try { fieldsToObject(fields); return null; } catch (error) { return error.message; }
}

export function scopedRuleFields(project) {
  if (!project.segments || !Object.keys(project.segments).length) return project.fields;
  const result = {};
  for (const [type, def] of Object.entries(project.segments)) {
    if (def.repeatable) result[type] = { type: 'list', label: def.label, required: !!def.required, item_fields: Object.fromEntries(Object.entries(def.fields || {}).filter(([, f]) => f.type !== 'list')) };
    for (const [id, field] of Object.entries(def.fields || {})) result[`${type}.${id}`] = { ...field, label: `${def.label} · ${field.label}` };
  }
  return result;
}
