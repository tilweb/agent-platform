/**
 * GanttRoadmap — wiederverwendbare Gantt-/Zeitachsen-Darstellung der Roadmap.
 *
 * Zeigt Hauptaufgaben (Balken), Meilensteine (Raute) und Quality Gates (Schild)
 * auf einer Zeitachse, in Treppenstufen (gestapelte Lanes, ohne Überlappung),
 * mit Heute-Marker, Hover-Tooltip und Klick-Sprung zum Listeneintrag.
 *
 * Context-agnostisch (Projektauftrag, Statusbericht, später Portfolio):
 *  - Items: { id, refId, type:'task'|'milestone'|'gate', name, date?, start_date?,
 *            end_date?, description?, tracking?, color? }
 *  - tracking (optional, Statusbericht): { ampel, fortschritt, ist_datum, status }
 *  - color (optional, Portfolio): explizite Balkenfarbe (überschreibt die
 *    Typ-Standardfarbe, z.B. Grau für Projekte ohne Ampel / Projektideen).
 *  - dependencies (optional, Portfolio): [{ from, to }] mit Item-IDs — zeichnet
 *    Finish-to-Start-Verbindungspfeile zwischen den Balken.
 *  - onItemClick(item): Aufrufer scrollt zum passenden Listeneintrag.
 *
 * Custom SVG (keine Chart-Library) — konsistent mit EarnedValueChart/HealthDonut.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { theme } from '../../../config/theme';
import { diamondPoints, shieldPath, MILESTONE_COLOR, GATE_COLOR } from './RoadmapShapes';

const AMPEL_COLORS = {
  gruen: theme.colors.success,
  gelb: theme.colors.warning,
  rot: theme.colors.error,
};

const TASK_COLOR = theme.colors.primary;

const PAD_X = 24;
const TOP_PAD = 12;
const LANE_H = 30;
const MARKER_R = 9;
const BAR_H = 16;
const AXIS_H = 26;
const MS_PER_DAY = 86400000;

const fmtDate = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const ts = (d) => {
  if (!d) return null;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? null : t;
};

// Achsen-Ticks: Monatsanfänge (oder Quartalsanfänge) zwischen min und max.
function buildTicks(minTs, maxTs, granularity) {
  const ticks = [];
  const start = new Date(minTs);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const stepMonths = granularity === 'quarter' ? 3 : 1;
  if (granularity === 'quarter') start.setMonth(Math.floor(start.getMonth() / 3) * 3);
  const cur = new Date(start);
  let guard = 0;
  while (cur.getTime() <= maxTs && guard < 240) {
    ticks.push(new Date(cur).getTime());
    cur.setMonth(cur.getMonth() + stepMonths);
    guard += 1;
  }
  return ticks;
}

const tickLabel = (t, granularity) => {
  const d = new Date(t);
  if (granularity === 'quarter') return `Q${Math.floor(d.getMonth() / 3) + 1} ${String(d.getFullYear()).slice(2)}`;
  return d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
};

function GanttRoadmap({ items = [], rangeStart, rangeEnd, onItemClick, compact = false, dependencies = [] }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [tooltip, setTooltip] = useState(null);
  const [granularity, setGranularity] = useState(null); // null = auto

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Items mit gültigen Datumsangaben + Zeitstempeln vorbereiten.
  const prepared = useMemo(() => {
    const valid = [];
    let skipped = 0;
    for (const it of items) {
      if (it.type === 'task') {
        const s = ts(it.start_date);
        const e = ts(it.end_date) ?? s;
        if (s == null) { skipped += 1; continue; }
        valid.push({ ...it, _start: s, _end: Math.max(e, s), _point: false });
      } else {
        const p = ts(it.date);
        if (p == null) { skipped += 1; continue; }
        const ist = ts(it.tracking?.ist_datum);
        valid.push({ ...it, _start: p, _end: p, _ist: ist, _point: true });
      }
    }
    return { valid, skipped };
  }, [items]);

  const bounds = useMemo(() => {
    const explicit = { min: ts(rangeStart), max: ts(rangeEnd) };
    const itemMin = prepared.valid.reduce((m, it) => Math.min(m, it._start, it._ist ?? it._start), Infinity);
    const itemMax = prepared.valid.reduce((m, it) => Math.max(m, it._end, it._ist ?? it._end), -Infinity);
    let min = explicit.min ?? (Number.isFinite(itemMin) ? itemMin : null);
    let max = explicit.max ?? (Number.isFinite(itemMax) ? itemMax : null);
    if (min == null || max == null) return null;
    // sicherstellen, dass Items innerhalb liegen
    if (Number.isFinite(itemMin)) min = Math.min(min, itemMin);
    if (Number.isFinite(itemMax)) max = Math.max(max, itemMax);
    if (max <= min) max = min + 30 * MS_PER_DAY;
    // kleines Padding (3%)
    const pad = (max - min) * 0.03;
    return { min: min - pad, max: max + pad };
  }, [prepared.valid, rangeStart, rangeEnd]);

  const svgW = Math.max(width - 32, 280);
  const usable = svgW - PAD_X * 2;
  const getX = (t) => {
    if (!bounds) return PAD_X;
    return PAD_X + ((t - bounds.min) / (bounds.max - bounds.min || 1)) * usable;
  };

  const effGranularity = useMemo(() => {
    if (granularity) return granularity;
    if (!bounds) return 'month';
    return (bounds.max - bounds.min) / MS_PER_DAY > 540 ? 'quarter' : 'month';
  }, [granularity, bounds]);

  // Greedy-Lane-Packing (Treppenstufen): Item in erste Lane ohne Überlappung.
  const laid = useMemo(() => {
    if (!bounds || svgW === 0) return { rows: [], laneCount: 0 };
    const approxChar = 6.4;
    const lanesEnd = []; // letzte belegte x-Position je Lane
    const rows = prepared.valid
      .slice()
      .sort((a, b) => a._start - b._start)
      .map((it) => {
        const xStart = getX(it._start);
        const markerRight = it._point ? xStart + MARKER_R : getX(it._end);
        const labelW = Math.min((it.name?.length || 4) * approxChar + 16, 220);
        const xEnd = markerRight + labelW;
        let lane = lanesEnd.findIndex((end) => xStart > end + 8);
        if (lane === -1) { lane = lanesEnd.length; lanesEnd.push(xEnd); }
        else lanesEnd[lane] = xEnd;
        return { ...it, lane, xStart, xEnd: it._point ? xStart : getX(it._end) };
      });
    return { rows, laneCount: lanesEnd.length };
  }, [prepared.valid, bounds, svgW]);

  const lanesTop = TOP_PAD + AXIS_H;
  const svgHeight = lanesTop + Math.max(laid.laneCount, 1) * LANE_H + 8;
  const ticks = bounds ? buildTicks(bounds.min, bounds.max, effGranularity) : [];
  const now = Date.now();

  const colorOf = (it) => {
    if (it.tracking?.ampel && AMPEL_COLORS[it.tracking.ampel]) return AMPEL_COLORS[it.tracking.ampel];
    if (it.color) return it.color;
    if (it.type === 'milestone') return MILESTONE_COLOR;
    if (it.type === 'gate') return GATE_COLOR;
    return TASK_COLOR;
  };

  // Abhängigkeits-Konnektoren (Finish-to-Start): vom Balkenende des Vorgängers
  // zum Balkenanfang des Nachfolgers. Nur zwischen platzierten (terminierten) Items.
  const depConnectors = useMemo(() => {
    if (!dependencies?.length || !laid.rows.length) return [];
    const byId = new Map(laid.rows.map((r) => [r.id, r]));
    const out = [];
    for (const d of dependencies) {
      const s = byId.get(d.from);
      const t = byId.get(d.to);
      if (!s || !t || s._point || t._point) continue;
      const sy = lanesTop + s.lane * LANE_H + LANE_H / 2;
      const ty = lanesTop + t.lane * LANE_H + LANE_H / 2;
      out.push({ key: `${d.from}->${d.to}`, sx: s.xEnd, sy, tx: t.xStart, ty });
    }
    return out;
  }, [dependencies, laid.rows, lanesTop]);

  const showTooltip = (it, e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const lines = [];
    if (it._point) {
      lines.push(['Datum', fmtDate(it.date)]);
      if (it._ist) lines.push(['Ist', fmtDate(it.tracking.ist_datum)]);
    } else {
      lines.push(['Zeitraum', `${fmtDate(it.start_date)} – ${fmtDate(it.end_date)}`]);
      if (it.responsible) lines.push(['Verantwortlich', it.responsible]);
    }
    if (it.tracking?.fortschritt != null) lines.push(['Fortschritt', `${it.tracking.fortschritt}%`]);
    setTooltip({
      typeLabel: it.type === 'task' ? 'Hauptaufgabe' : it.type === 'gate' ? 'Quality Gate' : 'Meilenstein',
      name: it.name,
      lines,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const moveTooltip = (e) => {
    if (!tooltip) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltip((prev) => (prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : null));
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        backgroundColor: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.lg,
        position: 'relative',
      }}
    >
      {/* Granularität-Umschalter */}
      {!compact && bounds && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
          {['month', 'quarter'].map((g) => {
            const active = effGranularity === g;
            return (
              <button
                key={g}
                type="button"
                onClick={() => setGranularity(g)}
                style={{
                  padding: `2px ${theme.spacing.sm}`,
                  fontSize: theme.typography.sizes.xs,
                  borderRadius: theme.borderRadius.sm,
                  border: `1px solid ${active ? theme.colors.primary : theme.colors.border}`,
                  backgroundColor: active ? theme.colors.primaryLight : 'transparent',
                  color: active ? theme.colors.primary : theme.colors.textMuted,
                  cursor: 'pointer',
                }}
              >
                {g === 'month' ? 'Monat' : 'Quartal'}
              </button>
            );
          })}
        </div>
      )}

      {!bounds || laid.rows.length === 0 ? (
        <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm, padding: theme.spacing.md }}>
          Noch keine terminierten Roadmap-Einträge.
        </div>
      ) : (
        <svg width={svgW} height={svgHeight} style={{ display: 'block' }}>
          {/* Achsen-Gridlines + Labels */}
          {ticks.map((t) => {
            const x = getX(t);
            return (
              <g key={t}>
                <line x1={x} y1={lanesTop - 4} x2={x} y2={svgHeight - 8} stroke={theme.colors.border} strokeWidth={1} strokeDasharray="2 3" />
                <text x={x} y={TOP_PAD + 12} textAnchor="middle" fill={theme.colors.textMuted} fontSize="10" fontFamily={theme.typography.fontFamily}>
                  {tickLabel(t, effGranularity)}
                </text>
              </g>
            );
          })}

          {/* Heute-Marker */}
          {now >= bounds.min && now <= bounds.max && (
            <g>
              <line x1={getX(now)} y1={lanesTop - 4} x2={getX(now)} y2={svgHeight - 8} stroke={theme.colors.error} strokeWidth={1.5} />
              <text x={getX(now)} y={svgHeight - 1} textAnchor="middle" fill={theme.colors.error} fontSize="9" fontFamily={theme.typography.fontFamily}>
                heute
              </text>
            </g>
          )}

          {/* Abhängigkeits-Konnektoren (unter den Balken gezeichnet) */}
          {depConnectors.map(({ key, sx, sy, tx, ty }) => {
            const stub = 8;
            const c = theme.colors.textSecondary;
            return (
              <g key={key} opacity={0.75}>
                <path
                  d={`M ${sx} ${sy} L ${sx + stub} ${sy} L ${sx + stub} ${ty} L ${tx} ${ty}`}
                  fill="none"
                  stroke={c}
                  strokeWidth={1.5}
                />
                <polygon points={`${tx},${ty} ${tx - 6},${ty - 4} ${tx - 6},${ty + 4}`} fill={c} />
              </g>
            );
          })}

          {/* Items */}
          {laid.rows.map((it) => {
            const cy = lanesTop + it.lane * LANE_H + LANE_H / 2;
            const color = colorOf(it);
            const label = it.name;
            const labelX = (it._point ? it.xStart + MARKER_R + 6 : it.xEnd + 6);
            const common = {
              style: { cursor: 'pointer' },
              onMouseEnter: (e) => showTooltip(it, e),
              onMouseMove: moveTooltip,
              onMouseLeave: () => setTooltip(null),
              onClick: () => onItemClick && onItemClick(it),
            };
            return (
              <g key={it.id} {...common}>
                {it._point ? (
                  <>
                    {/* Ist-Marker (Outline) + Verbindung bei Abweichung */}
                    {it._ist && it._ist !== it._start && (
                      <>
                        <line x1={it.xStart} y1={cy} x2={getX(it._ist)} y2={cy} stroke={color} strokeWidth={1} strokeDasharray="2 2" />
                        {it.type === 'gate'
                          ? <path d={shieldPath(getX(it._ist), cy, MARKER_R)} fill="none" stroke={color} strokeWidth={1.5} />
                          : <polygon points={diamondPoints(getX(it._ist), cy, MARKER_R)} fill="none" stroke={color} strokeWidth={1.5} />}
                      </>
                    )}
                    {it.type === 'gate'
                      ? <path d={shieldPath(it.xStart, cy, MARKER_R)} fill={color} />
                      : <polygon points={diamondPoints(it.xStart, cy, MARKER_R)} fill={color} />}
                  </>
                ) : (
                  <>
                    {/* Task-Balken */}
                    <rect x={it.xStart} y={cy - BAR_H / 2} width={Math.max(it.xEnd - it.xStart, 3)} height={BAR_H} rx={4} fill={`${color}33`} stroke={color} strokeWidth={1} />
                    {/* Fortschritt */}
                    {it.tracking?.fortschritt > 0 && (
                      <rect x={it.xStart} y={cy - BAR_H / 2} width={Math.max((it.xEnd - it.xStart) * Math.min(it.tracking.fortschritt, 100) / 100, 2)} height={BAR_H} rx={4} fill={color} opacity={0.85} />
                    )}
                  </>
                )}
                <text x={labelX} y={cy + 4} fill={theme.colors.text} fontSize="11" fontFamily={theme.typography.fontFamily}>
                  {label.length > 36 ? `${label.slice(0, 35)}…` : label}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {prepared.skipped > 0 && (
        <div style={{ marginTop: theme.spacing.sm, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
          {prepared.skipped} Eintrag/Einträge ohne (gültiges) Datum werden in der Grafik nicht angezeigt.
        </div>
      )}

      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y - 12,
            transform: 'translate(-50%, -100%)',
            backgroundColor: theme.colors.text,
            color: theme.colors.surface,
            padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            borderRadius: theme.borderRadius.md,
            fontSize: theme.typography.sizes.xs,
            maxWidth: '260px',
            pointerEvents: 'none',
            zIndex: 10,
            boxShadow: theme.shadows.lg,
          }}
        >
          <div style={{ opacity: 0.6, fontSize: '10px', marginBottom: '2px' }}>{tooltip.typeLabel}</div>
          <div style={{ fontWeight: theme.typography.weights.semibold, fontSize: theme.typography.sizes.sm, marginBottom: tooltip.lines.length ? '4px' : 0 }}>
            {tooltip.name}
          </div>
          {tooltip.lines.map(([k, v]) => (
            <div key={k} style={{ opacity: 0.85 }}>
              <span style={{ opacity: 0.7 }}>{k}:</span> {v}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GanttRoadmap;
