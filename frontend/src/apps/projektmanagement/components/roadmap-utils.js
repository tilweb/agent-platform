/**
 * Hilfsfunktionen für die Roadmap-/Gantt-Darstellung.
 * (Separat von GanttRoadmap.jsx, damit die Komponentendatei nur Komponenten
 *  exportiert — react-refresh/only-export-components.)
 */

/**
 * Normalisiert die drei Roadmap-Arrays (+ optionale Tracking-Arrays, index-aligned)
 * auf das einheitliche Gantt-Item-Modell:
 *   { id, refId, type:'task'|'milestone'|'gate', name, date?, start_date?,
 *     end_date?, description?, responsible?, status?, tracking? }
 */
export function toGanttItems({ milestones = [], qualityGates = [], tasks = [], tracking } = {}) {
  const items = [];
  tasks.forEach((t, i) => {
    if (!t || !t.name) return;
    items.push({
      id: `task-${t.id || i}`,
      refId: t.id ?? i,
      type: 'task',
      name: t.name,
      start_date: t.start_date,
      end_date: t.end_date,
      responsible: t.responsible,
      status: t.status,
      tracking: tracking?.tasks?.[i],
    });
  });
  milestones.forEach((m, i) => {
    if (!m || !m.name) return;
    items.push({
      id: `milestone-${m.id || i}`,
      refId: m.id ?? i,
      type: 'milestone',
      name: m.name,
      date: m.date,
      description: m.description,
      tracking: tracking?.milestones?.[i],
    });
  });
  qualityGates.forEach((g, i) => {
    if (!g || !g.name) return;
    items.push({
      id: `gate-${g.id || i}`,
      refId: g.id ?? i,
      type: 'gate',
      name: g.name,
      date: g.date,
      tracking: tracking?.gates?.[i],
    });
  });
  return items;
}
