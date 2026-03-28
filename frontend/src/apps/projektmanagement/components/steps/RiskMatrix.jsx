/**
 * RiskMatrix - Klassische Risikomatrix (Wahrscheinlichkeit x Auswirkung)
 * Zwei Matrizen: Bedrohungen und Chancen.
 * Ampelfarben, dynamische Achsen, Kreisgroesse nach Auswirkung.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { theme } from '../../../../config/theme';

const PADDING = { top: 24, right: 24, bottom: 56, left: 80 };
const MIN_CELL = 80;
const MIN_R = 12;
const MAX_R = 24;

// Traffic light colors (semi-transparent for cell backgrounds)
const COLORS = {
  green: 'rgba(34, 197, 94, 0.18)',
  yellow: 'rgba(234, 179, 8, 0.18)',
  red: 'rgba(239, 68, 68, 0.18)',
  greenBorder: 'rgba(34, 197, 94, 0.35)',
  yellowBorder: 'rgba(234, 179, 8, 0.35)',
  redBorder: 'rgba(239, 68, 68, 0.35)',
};

function SingleMatrix({ title, risks, probabilityOptions, impactOptions, isOpportunity }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(500);
  const [tooltip, setTooltip] = useState(null);

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

  const cols = probabilityOptions.length;
  const rows = impactOptions.length;

  // Flip impact so highest is at top
  const impactReversed = useMemo(() => [...impactOptions].reverse(), [impactOptions]);

  // Square cells
  const availW = Math.max(width - PADDING.left - PADDING.right, cols * MIN_CELL);
  const cellSize = Math.max(availW / cols, MIN_CELL);
  const cellW = cellSize;
  const cellH = cellSize;
  const gridW = cellW * cols;
  const gridH = cellH * rows;
  const svgW = gridW + PADDING.left + PADDING.right;
  const svgH = gridH + PADDING.top + PADDING.bottom;

  // Index maps
  const probIndex = useMemo(() => {
    const map = {};
    probabilityOptions.forEach((o, i) => { map[o.value] = i; });
    return map;
  }, [probabilityOptions]);

  const impactIndex = useMemo(() => {
    const map = {};
    impactOptions.forEach((o, i) => { map[o.value] = i; });
    return map;
  }, [impactOptions]);

  // Cell color based on risk score
  const getCellColor = (probIdx, impIdx) => {
    const maxScore = (cols - 1) + (rows - 1);
    const score = maxScore > 0 ? (probIdx + impIdx) / maxScore : 0;

    if (isOpportunity) {
      // Opportunities: high score = green, low = red
      if (score >= 0.67) return { fill: COLORS.green, stroke: COLORS.greenBorder };
      if (score >= 0.33) return { fill: COLORS.yellow, stroke: COLORS.yellowBorder };
      return { fill: COLORS.red, stroke: COLORS.redBorder };
    } else {
      // Threats: high score = red, low = green
      if (score >= 0.67) return { fill: COLORS.red, stroke: COLORS.redBorder };
      if (score >= 0.33) return { fill: COLORS.yellow, stroke: COLORS.yellowBorder };
      return { fill: COLORS.green, stroke: COLORS.greenBorder };
    }
  };

  // Group risks by cell
  const cells = useMemo(() => {
    const map = {};
    risks.forEach((risk) => {
      const pi = probIndex[risk.probability];
      const ii = impactIndex[risk.impact];
      if (pi === undefined || ii === undefined) return;
      const key = `${pi}-${ii}`;
      if (!map[key]) map[key] = [];
      map[key].push(risk);
    });
    return map;
  }, [risks, probIndex, impactIndex]);

  // Circle radius based on impact
  const getRadius = (impactValue) => {
    const ii = impactIndex[impactValue];
    if (ii === undefined) return MIN_R;
    const maxIdx = rows - 1;
    if (maxIdx === 0) return (MIN_R + MAX_R) / 2;
    return MIN_R + (ii / maxIdx) * (MAX_R - MIN_R);
  };

  // Positions within a cell for collision handling
  const getPositions = (count) => {
    if (count === 1) return [{ dx: 0, dy: 0 }];
    if (count === 2) return [{ dx: -14, dy: 0 }, { dx: 14, dy: 0 }];
    if (count === 3) return [{ dx: 0, dy: -12 }, { dx: -14, dy: 12 }, { dx: 14, dy: 12 }];
    if (count === 4) return [{ dx: -14, dy: -12 }, { dx: 14, dy: -12 }, { dx: -14, dy: 12 }, { dx: 14, dy: 12 }];
    const positions = [];
    const ring = Math.ceil(Math.sqrt(count));
    const step = MAX_R * 1.5;
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / ring);
      const col = i % ring;
      const rowCount = Math.min(ring, count - row * ring);
      const offsetX = (col - (rowCount - 1) / 2) * step;
      const offsetY = (row - (Math.ceil(count / ring) - 1) / 2) * step;
      positions.push({ dx: offsetX, dy: offsetY });
    }
    return positions;
  };

  const getInitials = (desc) => {
    if (!desc) return '?';
    // Use first letter of first two words of description
    const words = desc.trim().split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  };

  return (
    <div style={{ marginBottom: theme.spacing.xl }}>
      <h4 style={{
        fontSize: theme.typography.sizes.base,
        fontWeight: theme.typography.weights.semibold,
        color: theme.colors.text,
        marginBottom: theme.spacing.md,
      }}>
        {title}
      </h4>

      <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
        {risks.length === 0 ? (
          <div style={{
            padding: theme.spacing.xl,
            textAlign: 'center',
            color: theme.colors.textMuted,
            fontSize: theme.typography.sizes.sm,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius.lg,
          }}>
            Keine {isOpportunity ? 'Chancen' : 'Bedrohungen'} erfasst.
          </div>
        ) : (
          <svg
            width={svgW}
            height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
          >
            {/* Cell backgrounds with traffic light colors */}
            {impactReversed.map((_, rowIdx) => {
              // rowIdx 0 = top = highest impact
              const impIdx = rows - 1 - rowIdx;
              return probabilityOptions.map((_, colIdx) => {
                const { fill, stroke } = getCellColor(colIdx, impIdx);
                return (
                  <rect
                    key={`cell-${colIdx}-${rowIdx}`}
                    x={PADDING.left + colIdx * cellW}
                    y={PADDING.top + rowIdx * cellH}
                    width={cellW}
                    height={cellH}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth="1"
                    rx="2"
                  />
                );
              });
            })}

            {/* X-axis labels (Wahrscheinlichkeit) */}
            {probabilityOptions.map((opt, i) => (
              <text
                key={`xl-${i}`}
                x={PADDING.left + i * cellW + cellW / 2}
                y={PADDING.top + gridH + 20}
                textAnchor="middle"
                fill={theme.colors.textSecondary}
                fontSize="12"
                fontWeight="500"
              >
                {opt.label}
              </text>
            ))}

            {/* X-axis title */}
            <text
              x={PADDING.left + gridW / 2}
              y={PADDING.top + gridH + 44}
              textAnchor="middle"
              fill={theme.colors.text}
              fontSize="12"
              fontWeight="600"
            >
              Wahrscheinlichkeit →
            </text>

            {/* Y-axis labels (Auswirkung) */}
            {impactReversed.map((opt, i) => (
              <text
                key={`yl-${i}`}
                x={PADDING.left - 12}
                y={PADDING.top + i * cellH + cellH / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fill={theme.colors.textSecondary}
                fontSize="12"
                fontWeight="500"
              >
                {opt.label}
              </text>
            ))}

            {/* Y-axis title */}
            <text
              x="16"
              y={PADDING.top + gridH / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={theme.colors.text}
              fontSize="12"
              fontWeight="600"
              transform={`rotate(-90, 16, ${PADDING.top + gridH / 2})`}
            >
              Auswirkung →
            </text>

            {/* Risk circles */}
            {Object.entries(cells).map(([key, group]) => {
              const [pi, ii] = key.split('-').map(Number);
              const rowIdx = rows - 1 - ii;
              const cx = PADDING.left + pi * cellW + cellW / 2;
              const cy = PADDING.top + rowIdx * cellH + cellH / 2;
              const positions = getPositions(group.length);

              return group.map((risk, ri) => {
                const px = cx + positions[ri].dx;
                const py = cy + positions[ri].dy;
                const r = getRadius(risk.impact);
                const initials = getInitials(risk.description);
                const fontSize = r >= 16 ? 10 : 8;

                return (
                  <g
                    key={risk.id || `${key}-${ri}`}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => {
                      const rect = containerRef.current?.getBoundingClientRect();
                      if (rect) {
                        const scale = rect.width / svgW;
                        setTooltip({
                          description: risk.description || 'Kein Titel',
                          mitigation: risk.mitigation,
                          x: px * scale,
                          y: py * scale,
                        });
                      }
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <circle
                      cx={px}
                      cy={py}
                      r={r}
                      fill={isOpportunity ? theme.colors.primaryLight : theme.colors.errorLight}
                      stroke={isOpportunity ? theme.colors.primary : theme.colors.error}
                      strokeWidth="2"
                    />
                    <text
                      x={px}
                      y={py}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={isOpportunity ? theme.colors.primary : theme.colors.error}
                      fontSize={fontSize}
                      fontWeight="600"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {initials}
                    </text>
                  </g>
                );
              });
            })}
          </svg>
        )}

        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y - 50,
            transform: 'translateX(-50%)',
            backgroundColor: theme.colors.text,
            color: theme.colors.surface,
            padding: `${theme.spacing.xs} ${theme.spacing.md}`,
            borderRadius: theme.borderRadius.md,
            fontSize: theme.typography.sizes.xs,
            fontWeight: theme.typography.weights.medium,
            maxWidth: '260px',
            pointerEvents: 'none',
            zIndex: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}>
            <div>{tooltip.description}</div>
            {tooltip.mitigation && (
              <div style={{ opacity: 0.7, fontSize: '10px', marginTop: '2px' }}>
                Maßnahme: {tooltip.mitigation}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RiskMatrix({ risks, probabilityOptions, impactOptions }) {
  const threats = useMemo(
    () => risks.filter((r) => r.nature !== 'chance' && r.probability && r.impact),
    [risks]
  );
  const opportunities = useMemo(
    () => risks.filter((r) => r.nature === 'chance' && r.probability && r.impact),
    [risks]
  );

  return (
    <div>
      <SingleMatrix
        title="Bedrohungen"
        risks={threats}
        probabilityOptions={probabilityOptions}
        impactOptions={impactOptions}
        isOpportunity={false}
      />
      <SingleMatrix
        title="Chancen"
        risks={opportunities}
        probabilityOptions={probabilityOptions}
        impactOptions={impactOptions}
        isOpportunity={true}
      />
    </div>
  );
}

export default RiskMatrix;
