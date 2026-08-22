/**
 * Gruppierungs- und Such-Helfer für die Übersichtsseiten (Agenten, Skills,
 * Knowledge Base, Tabellen). Rein funktional, kein React.
 *
 * Ableitung der Zugriffs-Gruppen aus den Feldern, die die Listen-Endpoints
 * bereits liefern:
 *   - System   → `isSystemAgent` / `system === true`
 *   - Gesperrt → `accessible === false` (Ressource existiert, aber keine Rolle)
 *   - Eigene   → `role === 'owner'`
 *   - Geteilt  → zugänglich mit Rolle ≠ owner (admin/editor/viewer)
 * Ressourcen ohne RBAC-Felder (z. B. Tabellen) landen in `own` (neutraler Bucket).
 */

export function deriveAccessGroups(items) {
  const system = [];
  const own = [];
  const shared = [];
  const locked = [];
  for (const it of items || []) {
    if (it.isSystemAgent || it.system) { system.push(it); continue; }
    if (it.accessible === false) { locked.push(it); continue; }
    if (it.role && it.role !== 'owner') { shared.push(it); continue; }
    own.push(it); // role === 'owner' oder keine RBAC-Felder
  }
  return { system, own, shared, locked };
}

/** Filtert nach Freitext in Name + Beschreibung (case-insensitive). */
export function filterBySearch(items, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return items;
  return (items || []).filter((it) => {
    const name = (it.name || '').toLowerCase();
    const desc = (typeof it.description === 'string' ? it.description : '').toLowerCase();
    const id = (it.id || '').toLowerCase();
    return name.includes(q) || desc.includes(q) || id.includes(q);
  });
}

/** Sortiert stabil nach Name (de). */
export function sortByName(items) {
  return [...(items || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'));
}
