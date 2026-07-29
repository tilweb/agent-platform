/**
 * PortfolioCostChart — gestapelte Spalten-Darstellung der Portfolio-Kosten.
 *
 * Pro Kennzahl (Budget / Ist / Prognose) eine Spalte, gestapelt nach dem Anteil
 * je Projekt. Die Spaltenhöhe = Portfolio-Summe der Kennzahl, die Segmente zeigen
 * die Zusammensetzung. Custom SVG (keine Chart-Library) — konsistent mit
 * GanttRoadmap/HealthDonut.
 *
 * Props:
 *  - projekte: [{ id, name, values: { [metricKey]: number } }]
 *  - metrics:  [{ key, label }]
 *  - formatValue(n): Formatierung der Beträge (z.B. EUR)
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { theme } from '../../../../config/theme';

const PALETTE = [
  theme.colors.primary,
  theme.colors.warning,
  theme.colors.success,
  theme.colors.error,
  theme.colors.info,
  '#8b5cf6',
  '#0ea5e9',
  '#ec4899',
  '#14b8a6',
  '#f59e0b',
];

const colorFor = (index) => PALETTE[index % PALETTE.length];

const TOP_PAD = 22;      // Platz für Spaltensumme
const BOTTOM_PAD = 26;   // Platz für Kennzahl-Label
const CHART_H = 300;
const COL_MAX_W = 130;

export default function PortfolioCostChart({ projekte = [], metrics = [], formatValue = (n) => `${n}` }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const totals = useMemo(
    () => metrics.map((m) => projekte.reduce((s, p) => s + (Number(p.values?.[m.key]) || 0), 0)),
    [metrics, projekte],
  );
  const maxTotal = useMemo(() => Math.max(1, ...totals), [totals]);

  const svgW = Math.max(width, 280);
  const plotH = CHART_H - TOP_PAD - BOTTOM_PAD;
  const n = metrics.length;
  const slotW = n > 0 ? svgW / n : svgW;
  const colW = Math.min(COL_MAX_W, slotW * 0.6);

  const hasData = projekte.length > 0 && totals.some((t) => t > 0);

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {/* Legende */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: theme.spacing.md,
        marginBottom: theme.spacing.md, fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary,
      }}>
        {projekte.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
            <div style={{ width: 12, height: 12, borderRadius: theme.borderRadius.sm, backgroundColor: colorFor(i), flexShrink: 0 }} />
            {p.name}
          </div>
        ))}
      </div>

      {!hasData ? (
        <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm, padding: theme.spacing.md }}>
          Keine Kostenwerte vorhanden.
        </div>
      ) : (
        <svg width={svgW} height={CHART_H} style={{ display: 'block' }}>
          {metrics.map((m, mi) => {
            const cx = slotW * mi + slotW / 2;
            const x = cx - colW / 2;
            const total = totals[mi];
            let yCursor = TOP_PAD + plotH; // von unten stapeln
            return (
              <g key={m.key}>
                {projekte.map((p, pi) => {
                  const val = Number(p.values?.[m.key]) || 0;
                  if (val <= 0) return null;
                  const h = (val / maxTotal) * plotH;
                  yCursor -= h;
                  const y = yCursor;
                  const showLabel = h >= 18;
                  return (
                    <g key={p.id}>
                      <rect x={x} y={y} width={colW} height={h} fill={colorFor(pi)}>
                        <title>{`${p.name} · ${m.label}: ${formatValue(val)}`}</title>
                      </rect>
                      {showLabel && (
                        <text
                          x={cx} y={y + h / 2 + 4} textAnchor="middle"
                          fill="#fff" fontSize="11" fontFamily={theme.typography.fontFamily}
                        >
                          {formatValue(val)}
                        </text>
                      )}
                    </g>
                  );
                })}
                {/* Summe über der Spalte */}
                <text
                  x={cx} y={TOP_PAD + plotH - (total / maxTotal) * plotH - 7}
                  textAnchor="middle" fill={theme.colors.text}
                  fontSize="12" fontWeight={theme.typography.weights.semibold}
                  fontFamily={theme.typography.fontFamily}
                >
                  {formatValue(total)}
                </text>
                {/* Kennzahl-Label */}
                <text
                  x={cx} y={CHART_H - 8} textAnchor="middle"
                  fill={theme.colors.textSecondary} fontSize="12" fontFamily={theme.typography.fontFamily}
                >
                  {m.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
