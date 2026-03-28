/**
 * RiskMovementMatrix - Risiko-Bewegungsmatrix (Soll/Ist Vergleich)
 * Zeigt Original-Position (Projektauftrag) als Outline-Kreise und
 * aktuelle Neubewertung (Statusbericht) als solide Kreise mit Pfeilen.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { theme } from '../../../../config/theme';

const PADDING = { top: 24, right: 24, bottom: 56, left: 80 };
const MIN_CELL = 80;
const CIRCLE_R = 14;

const CELL_COLORS = {
  green: 'rgba(34, 197, 94, 0.18)',
  yellow: 'rgba(234, 179, 8, 0.18)',
  red: 'rgba(239, 68, 68, 0.18)',
  greenBorder: 'rgba(34, 197, 94, 0.35)',
  yellowBorder: 'rgba(234, 179, 8, 0.35)',
  redBorder: 'rgba(239, 68, 68, 0.35)',
};

const AMPEL_COLORS = {
  gruen: theme.colors.success,
  gelb: theme.colors.warning,
  rot: theme.colors.error,
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },
  summaryBar: {
    display: 'flex',
    gap: theme.spacing.xl,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
  },
  summaryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
  },
  summaryDot: {
    width: '10px',
    height: '10px',
    borderRadius: theme.borderRadius.full,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  legend: {
    display: 'flex',
    gap: theme.spacing.lg,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    padding: `${theme.spacing.sm} 0`,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  emptyState: {
    padding: theme.spacing.xl,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
  },
  hint: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
};

function SingleMovementMatrix({ title, pairs, probabilityOptions, impactOptions, isOpportunity }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(500);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const cols = probabilityOptions.length;
  const rows = impactOptions.length;
  const impactReversed = useMemo(() => [...impactOptions].reverse(), [impactOptions]);

  const availW = Math.max(width - PADDING.left - PADDING.right, cols * MIN_CELL);
  const cellSize = Math.max(availW / cols, MIN_CELL);
  const gridW = cellSize * cols;
  const gridH = cellSize * rows;
  const svgW = gridW + PADDING.left + PADDING.right;
  const svgH = gridH + PADDING.top + PADDING.bottom;

  const probIndex = useMemo(() => {
    const m = {};
    probabilityOptions.forEach((o, i) => { m[o.value] = i; });
    return m;
  }, [probabilityOptions]);

  const impactIndex = useMemo(() => {
    const m = {};
    impactOptions.forEach((o, i) => { m[o.value] = i; });
    return m;
  }, [impactOptions]);

  const getCellColor = (pIdx, iIdx) => {
    const maxScore = (cols - 1) + (rows - 1);
    const score = maxScore > 0 ? (pIdx + iIdx) / maxScore : 0;
    if (isOpportunity) {
      if (score >= 0.67) return { fill: CELL_COLORS.green, stroke: CELL_COLORS.greenBorder };
      if (score >= 0.33) return { fill: CELL_COLORS.yellow, stroke: CELL_COLORS.yellowBorder };
      return { fill: CELL_COLORS.red, stroke: CELL_COLORS.redBorder };
    }
    if (score >= 0.67) return { fill: CELL_COLORS.red, stroke: CELL_COLORS.redBorder };
    if (score >= 0.33) return { fill: CELL_COLORS.yellow, stroke: CELL_COLORS.yellowBorder };
    return { fill: CELL_COLORS.green, stroke: CELL_COLORS.greenBorder };
  };

  // Compute cell center position
  const cellCenter = (pIdx, iIdx) => {
    const rowIdx = rows - 1 - iIdx;
    return {
      x: PADDING.left + pIdx * cellSize + cellSize / 2,
      y: PADDING.top + rowIdx * cellSize + cellSize / 2,
    };
  };

  // Prepare render data
  const renderPairs = useMemo(() => {
    return pairs.map((pair, i) => {
      const origPI = probIndex[pair.origProb];
      const origII = impactIndex[pair.origImpact];
      const currPI = probIndex[pair.currProb];
      const currII = impactIndex[pair.currImpact];

      const hasOrig = origPI !== undefined && origII !== undefined;
      const hasCurr = currPI !== undefined && currII !== undefined;

      return {
        ...pair,
        index: i,
        origPos: hasOrig ? cellCenter(origPI, origII) : null,
        currPos: hasCurr ? cellCenter(currPI, currII) : null,
        hasMoved: hasOrig && hasCurr && (origPI !== currPI || origII !== currII),
      };
    });
  }, [pairs, probIndex, impactIndex, cellSize, rows]);

  // Offset overlapping items in same cell
  const getOffset = (pairs, pos, index) => {
    if (!pos) return { dx: 0, dy: 0 };
    const sameCell = pairs.filter((p, i) => {
      const pPos = p.currPos || p.origPos;
      return pPos && pPos.x === pos.x && pPos.y === pos.y && i < index;
    }).length;
    const offsets = [
      { dx: 0, dy: 0 },
      { dx: -16, dy: 0 }, { dx: 16, dy: 0 },
      { dx: 0, dy: -16 }, { dx: 0, dy: 16 },
    ];
    return offsets[sameCell % offsets.length];
  };

  if (pairs.length === 0) {
    return (
      <div style={{ marginBottom: theme.spacing.xl }}>
        <h4 style={styles.sectionTitle}>{title}</h4>
        <div style={styles.emptyState}>
          Keine {isOpportunity ? 'Chancen' : 'Bedrohungen'} mit Bewertung vorhanden.
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: theme.spacing.xl }}>
      <h4 style={styles.sectionTitle}>{title}</h4>

      <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
        >
          {/* Arrow marker */}
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill={theme.colors.textSecondary} />
            </marker>
          </defs>

          {/* Cell backgrounds */}
          {impactReversed.map((_, rowIdx) => {
            const impIdx = rows - 1 - rowIdx;
            return probabilityOptions.map((_, colIdx) => {
              const { fill, stroke } = getCellColor(colIdx, impIdx);
              return (
                <rect
                  key={`cell-${colIdx}-${rowIdx}`}
                  x={PADDING.left + colIdx * cellSize}
                  y={PADDING.top + rowIdx * cellSize}
                  width={cellSize}
                  height={cellSize}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth="1"
                  rx="2"
                />
              );
            });
          })}

          {/* X-axis labels */}
          {probabilityOptions.map((opt, i) => (
            <text
              key={`xl-${i}`}
              x={PADDING.left + i * cellSize + cellSize / 2}
              y={PADDING.top + gridH + 20}
              textAnchor="middle"
              fill={theme.colors.textSecondary}
              fontSize="12"
              fontWeight="500"
            >
              {opt.label}
            </text>
          ))}
          <text
            x={PADDING.left + gridW / 2}
            y={PADDING.top + gridH + 44}
            textAnchor="middle"
            fill={theme.colors.text}
            fontSize="12"
            fontWeight="600"
          >
            Wahrscheinlichkeit &rarr;
          </text>

          {/* Y-axis labels */}
          {impactReversed.map((opt, i) => (
            <text
              key={`yl-${i}`}
              x={PADDING.left - 12}
              y={PADDING.top + i * cellSize + cellSize / 2}
              textAnchor="end"
              dominantBaseline="middle"
              fill={theme.colors.textSecondary}
              fontSize="12"
              fontWeight="500"
            >
              {opt.label}
            </text>
          ))}
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
            Auswirkung &rarr;
          </text>

          {/* Arrows for moved risks */}
          {renderPairs.map((pair) => {
            if (!pair.hasMoved || !pair.origPos || !pair.currPos) return null;
            const origOff = getOffset(renderPairs, pair.origPos, pair.index);
            const currOff = getOffset(renderPairs, pair.currPos, pair.index);
            const x1 = pair.origPos.x + origOff.dx;
            const y1 = pair.origPos.y + origOff.dy;
            const x2 = pair.currPos.x + currOff.dx;
            const y2 = pair.currPos.y + currOff.dy;
            // Shorten line by CIRCLE_R at each end
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < CIRCLE_R * 2 + 4) return null;
            const ux = dx / len;
            const uy = dy / len;
            const sx = x1 + ux * (CIRCLE_R + 2);
            const sy = y1 + uy * (CIRCLE_R + 2);
            const ex = x2 - ux * (CIRCLE_R + 4);
            const ey = y2 - uy * (CIRCLE_R + 4);
            // Midpoint with slight curve
            const midX = (sx + ex) / 2;
            const midY = (sy + ey) / 2 - 15;

            return (
              <path
                key={`arrow-${pair.index}`}
                d={`M ${sx} ${sy} Q ${midX} ${midY} ${ex} ${ey}`}
                stroke={theme.colors.textSecondary}
                strokeWidth="1.5"
                fill="none"
                strokeDasharray="4 3"
                opacity="0.5"
                markerEnd="url(#arrowhead)"
              />
            );
          })}

          {/* Original positions (ghost circles) */}
          {renderPairs.map((pair) => {
            if (!pair.origPos) return null;
            const off = getOffset(renderPairs, pair.origPos, pair.index);
            return (
              <g
                key={`orig-${pair.index}`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    const scale = rect.width / svgW;
                    setTooltip({
                      name: pair.beschreibung,
                      type: 'Ausgangsbewertung (Projektauftrag)',
                      x: (pair.origPos.x + off.dx) * scale,
                      y: (pair.origPos.y + off.dy) * scale,
                    });
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <circle
                  cx={pair.origPos.x + off.dx}
                  cy={pair.origPos.y + off.dy}
                  r={CIRCLE_R}
                  fill="none"
                  stroke={theme.colors.textMuted}
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
                <text
                  x={pair.origPos.x + off.dx}
                  y={pair.origPos.y + off.dy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={theme.colors.textMuted}
                  fontSize="10"
                  fontWeight="600"
                  style={{ pointerEvents: 'none' }}
                >
                  {pair.num}
                </text>
              </g>
            );
          })}

          {/* Current positions (solid circles with ampel color) */}
          {renderPairs.map((pair) => {
            if (!pair.currPos) return null;
            const off = getOffset(renderPairs, pair.currPos, pair.index);
            const fillColor = AMPEL_COLORS[pair.ampel] || theme.colors.primary;
            return (
              <g
                key={`curr-${pair.index}`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    const scale = rect.width / svgW;
                    setTooltip({
                      name: pair.beschreibung,
                      type: 'Aktuelle Bewertung',
                      ampel: pair.ampel,
                      strategie: pair.strategie,
                      x: (pair.currPos.x + off.dx) * scale,
                      y: (pair.currPos.y + off.dy) * scale,
                    });
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <circle
                  cx={pair.currPos.x + off.dx}
                  cy={pair.currPos.y + off.dy}
                  r={CIRCLE_R}
                  fill={fillColor}
                  stroke={fillColor}
                  strokeWidth="2"
                />
                <text
                  x={pair.currPos.x + off.dx}
                  y={pair.currPos.y + off.dy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#fff"
                  fontSize="10"
                  fontWeight="600"
                  style={{ pointerEvents: 'none' }}
                >
                  {pair.num}
                </text>
              </g>
            );
          })}
        </svg>

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
            maxWidth: '280px',
            pointerEvents: 'none',
            zIndex: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}>
            <div style={{ opacity: 0.6, fontSize: '10px', marginBottom: '2px' }}>{tooltip.type}</div>
            <div>{tooltip.name}</div>
            {tooltip.strategie && (
              <div style={{ opacity: 0.7, fontSize: '10px', marginTop: '2px' }}>
                Strategie: {tooltip.strategie}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RiskMovementMatrix({ riskTracking, projektauftragRisks, probabilityOptions, impactOptions }) {
  // Match tracking items to their Projektauftrag source
  const auftragById = useMemo(() => {
    const m = {};
    (projektauftragRisks || []).forEach((r) => { if (r.id) m[r.id] = r; });
    return m;
  }, [projektauftragRisks]);

  // Build paired data
  const allPairs = useMemo(() => {
    let threatNum = 0;
    let chanceNum = 0;

    return (riskTracking || []).map((rt) => {
      const orig = rt.auftrag_risk_id ? auftragById[rt.auftrag_risk_id] : null;
      const num = rt.type === 'chance' ? ++chanceNum : ++threatNum;
      return {
        beschreibung: rt.beschreibung || '',
        type: rt.type,
        ampel: rt.ampel,
        strategie: rt.strategie,
        num,
        origProb: orig?.probability || '',
        origImpact: orig?.impact || '',
        currProb: rt.wahrscheinlichkeit || '',
        currImpact: rt.auswirkung_bewertung || '',
      };
    });
  }, [riskTracking, auftragById]);

  const threatPairs = allPairs.filter((p) => p.type === 'bedrohung');
  const chancePairs = allPairs.filter((p) => p.type === 'chance');

  // Delta summary
  const computeDelta = (pairs) => {
    const probIdx = {};
    probabilityOptions.forEach((o, i) => { probIdx[o.value] = i; });
    const impIdx = {};
    impactOptions.forEach((o, i) => { impIdx[o.value] = i; });

    let improved = 0, worsened = 0, unchanged = 0, unrated = 0;

    pairs.forEach((p) => {
      const opi = probIdx[p.origProb];
      const oii = impIdx[p.origImpact];
      const cpi = probIdx[p.currProb];
      const cii = impIdx[p.currImpact];

      if (opi === undefined || oii === undefined || cpi === undefined || cii === undefined) {
        unrated++;
        return;
      }

      const origScore = opi + oii;
      const currScore = cpi + cii;

      if (origScore === currScore) unchanged++;
      else if (p.type === 'chance' ? currScore > origScore : currScore < origScore) improved++;
      else worsened++;
    });

    return { improved, worsened, unchanged, unrated };
  };

  const allFiltered = allPairs.filter((p) => p.currProb || p.origProb);
  const delta = computeDelta(allFiltered);

  if (probabilityOptions.length === 0 || impactOptions.length === 0) {
    return (
      <div style={styles.emptyState}>
        Bitte konfigurieren Sie Wahrscheinlichkeits- und Auswirkungsoptionen in den Einstellungen.
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Delta Summary */}
      {(delta.improved + delta.worsened + delta.unchanged) > 0 && (
        <div style={styles.summaryBar}>
          <div style={styles.summaryItem}>
            <div style={{ ...styles.summaryDot, backgroundColor: theme.colors.success }} />
            <span style={{ color: theme.colors.success, fontWeight: theme.typography.weights.semibold }}>
              {delta.improved}
            </span>
            <span style={{ color: theme.colors.textSecondary }}>verbessert</span>
          </div>
          <div style={styles.summaryItem}>
            <div style={{ ...styles.summaryDot, backgroundColor: theme.colors.error }} />
            <span style={{ color: theme.colors.error, fontWeight: theme.typography.weights.semibold }}>
              {delta.worsened}
            </span>
            <span style={{ color: theme.colors.textSecondary }}>verschlechtert</span>
          </div>
          <div style={styles.summaryItem}>
            <div style={{ ...styles.summaryDot, backgroundColor: theme.colors.textMuted }} />
            <span style={{ fontWeight: theme.typography.weights.semibold, color: theme.colors.text }}>
              {delta.unchanged}
            </span>
            <span style={{ color: theme.colors.textSecondary }}>unverändert</span>
          </div>
          {delta.unrated > 0 && (
            <div style={styles.summaryItem}>
              <span style={{ color: theme.colors.textMuted }}>
                ({delta.unrated} ohne vollständige Bewertung)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <svg width="14" height="14" viewBox="0 0 14 14">
            <circle cx="7" cy="7" r="5" fill="none" stroke={theme.colors.textMuted} strokeWidth="1.5" strokeDasharray="3 2" />
          </svg>
          Ausgangsbewertung (Projektauftrag)
        </div>
        <div style={styles.legendItem}>
          <svg width="14" height="14" viewBox="0 0 14 14">
            <circle cx="7" cy="7" r="5" fill={theme.colors.primary} />
          </svg>
          Aktuelle Bewertung (Statusbericht)
        </div>
        <div style={styles.legendItem}>
          <svg width="20" height="14" viewBox="0 0 20 14">
            <line x1="2" y1="7" x2="18" y2="7" stroke={theme.colors.textSecondary} strokeWidth="1.5" strokeDasharray="3 2" />
          </svg>
          Bewegung
        </div>
      </div>

      <p style={styles.hint}>
        Die Kreisfarbe zeigt die aktuelle Ampel-Einschätzung. Gestrichelte Kreise markieren die Ausgangsbewertung aus dem Projektauftrag.
      </p>

      {/* Threat matrix */}
      <SingleMovementMatrix
        title="Bedrohungen"
        pairs={threatPairs}
        probabilityOptions={probabilityOptions}
        impactOptions={impactOptions}
        isOpportunity={false}
      />

      {/* Opportunity matrix */}
      <SingleMovementMatrix
        title="Chancen"
        pairs={chancePairs}
        probabilityOptions={probabilityOptions}
        impactOptions={impactOptions}
        isOpportunity={true}
      />
    </div>
  );
}

export default RiskMovementMatrix;
