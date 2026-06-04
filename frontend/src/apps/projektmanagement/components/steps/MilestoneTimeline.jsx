/**
 * MilestoneTimeline - Horizontale SVG-Timeline für Meilensteine
 * Zeigt nummerierte Meilensteine proportional auf einer Zeitachse.
 * Voller Name + Beschreibung per Hover-Tooltip.
 * Nur sichtbar wenn >= 2 Meilensteine mit Datum existieren.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { theme } from '../../../../config/theme';
import { diamondPoints, shieldPath, MILESTONE_COLOR, GATE_COLOR } from '../RoadmapShapes';

const CIRCLE_R = 14;
const LINE_Y = 30;
const PADDING_X = 24;

function MilestoneTimeline({ milestones, qualityGates = [] }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [tooltip, setTooltip] = useState(null);

  const dated = useMemo(
    () => {
      const ms = milestones
        .filter((m) => m.name && m.date)
        .map((m) => ({ ...m, _type: 'milestone', timestamp: new Date(m.date).getTime() }));
      const qg = qualityGates
        .filter((g) => g.name && g.date)
        .map((g) => ({ ...g, _type: 'gate', timestamp: new Date(g.date).getTime() }));
      return [...ms, ...qg].sort((a, b) => a.timestamp - b.timestamp);
    },
    [milestones, qualityGates]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(() => {
    if (dated.length < 2 || width === 0) return [];

    const svgW = width - 32;
    const minTs = dated[0].timestamp;
    const maxTs = dated[dated.length - 1].timestamp;
    const range = maxTs - minTs || 1;
    const usable = svgW - PADDING_X * 2;
    const getX = (ts) => PADDING_X + ((ts - minTs) / range) * usable;

    // Separate counters per type
    let msCount = 0;
    let qgCount = 0;
    return dated.map((m) => {
      const num = m._type === 'gate' ? ++qgCount : ++msCount;
      return { ...m, x: getX(m.timestamp), num };
    });
  }, [dated, width]);

  if (dated.length < 2 || width === 0) {
    return (
      <div
        ref={containerRef}
        style={{ width: '100%', minHeight: dated.length < 2 ? 0 : 1 }}
      />
    );
  }

  const today = Date.now();
  const minTs = dated[0].timestamp;
  const maxTs = dated[dated.length - 1].timestamp;
  const svgW = width - 32;
  const svgHeight = LINE_Y + CIRCLE_R + 24;

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
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
        marginBottom: theme.spacing.lg,
        position: 'relative',
      }}
    >
      <svg width={svgW} height={svgHeight} style={{ display: 'block' }}>
        {/* Timeline line */}
        <line
          x1={PADDING_X}
          y1={LINE_Y}
          x2={svgW - PADDING_X}
          y2={LINE_Y}
          stroke={theme.colors.border}
          strokeWidth={2}
        />

        {/* Today marker */}
        {today >= minTs && today <= maxTs && (() => {
          const usable = svgW - PADDING_X * 2;
          const todayX = PADDING_X + ((today - minTs) / (maxTs - minTs || 1)) * usable;
          return (
            <line
              x1={todayX}
              y1={LINE_Y - 10}
              x2={todayX}
              y2={LINE_Y + 10}
              stroke={theme.colors.warning}
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })()}

        {/* Timeline nodes */}
        {layout.map((m) => {
          const isGate = m._type === 'gate';
          // Meilenstein = grüne Raute, Quality Gate = amber Schild.
          const color = isGate ? GATE_COLOR : MILESTONE_COLOR;

          return (
            <g
              key={m.id || m.num}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => {
                const rect = containerRef.current.getBoundingClientRect();
                setTooltip({
                  name: m.name,
                  date: formatDate(m.date),
                  description: m.description,
                  type: isGate ? 'Quality Gate' : 'Meilenstein',
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                });
              }}
              onMouseMove={(e) => {
                if (tooltip) {
                  const rect = containerRef.current.getBoundingClientRect();
                  setTooltip((prev) =>
                    prev
                      ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top }
                      : null
                  );
                }
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              {isGate ? (
                /* Schild für Quality Gates */
                <path d={shieldPath(m.x, LINE_Y, CIRCLE_R)} fill={color} />
              ) : (
                /* Raute (grün) für Meilensteine */
                <polygon points={diamondPoints(m.x, LINE_Y, CIRCLE_R)} fill={color} />
              )}

              {/* Number */}
              <text
                x={m.x}
                y={LINE_Y + 4}
                textAnchor="middle"
                fill="#fff"
                fontSize="11"
                fontWeight={theme.typography.weights.semibold}
                fontFamily={theme.typography.fontFamily}
              >
                {m.num}
              </text>

              {/* Date below */}
              <text
                x={m.x}
                y={LINE_Y + CIRCLE_R + 16}
                textAnchor="middle"
                fill={theme.colors.textMuted}
                fontSize="10"
                fontFamily={theme.typography.fontFamily}
              >
                {formatDate(m.date)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
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
          {tooltip.type && (
            <div style={{ opacity: 0.6, fontSize: '10px', marginBottom: '2px' }}>{tooltip.type}</div>
          )}
          <div
            style={{
              fontWeight: theme.typography.weights.semibold,
              fontSize: theme.typography.sizes.sm,
              marginBottom: tooltip.description ? '4px' : 0,
            }}
          >
            {tooltip.name}
          </div>
          {tooltip.description && (
            <div style={{ opacity: 0.8, lineHeight: 1.4 }}>{tooltip.description}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default MilestoneTimeline;
