/**
 * StakeholderMatrix - Interesse/Einfluss Klassifizierungsmatrix
 * Custom SVG visualization with dynamic axes from config.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { theme } from '../../../../config/theme';

const PADDING = { top: 24, right: 24, bottom: 68, left: 80 };
const MIN_CELL = 80;
const AVATAR_R = 18;

// Bricht ein langes Achsen-Label in mehrere Zeilen (greedy nach Wörtern),
// damit die X-Achsenbeschriftung lesbar bleibt statt zu überlappen.
function wrapLabel(label, maxChars = 12) {
  const words = String(label ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur.length + 1 + w.length) > maxChars) { lines.push(cur); cur = w; }
    else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function StakeholderMatrix({ people, interestOptions, influenceOptions, roleOptions, quadrantOptions }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(600);
  const [tooltip, setTooltip] = useState(null);

  // Responsive width
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

  const cols = interestOptions.length;
  const rows = influenceOptions.length;

  // Flip influence so highest value is at top
  const influenceReversed = useMemo(() => [...influenceOptions].reverse(), [influenceOptions]);

  // Grid dimensions — square cells
  const availW = Math.max(width - PADDING.left - PADDING.right, cols * MIN_CELL);
  const cellSize = Math.max(availW / cols, MIN_CELL);
  const cellW = cellSize;
  const cellH = cellSize;
  const gridW = cellW * cols;
  const gridH = cellH * rows;
  const svgW = gridW + PADDING.left + PADDING.right;
  const svgH = gridH + PADDING.top + PADDING.bottom;

  // Build value→index maps
  const interestIndex = useMemo(() => {
    const map = {};
    interestOptions.forEach((o, i) => { map[o.value] = i; });
    return map;
  }, [interestOptions]);

  const influenceIndex = useMemo(() => {
    const map = {};
    influenceOptions.forEach((o, i) => { map[o.value] = i; });
    return map;
  }, [influenceOptions]);

  // Group people by cell
  const cells = useMemo(() => {
    const map = {};
    people.forEach((person) => {
      const xi = interestIndex[person.interest];
      const yi = influenceIndex[person.influence];
      if (xi === undefined || yi === undefined) return;
      const key = `${xi}-${yi}`;
      if (!map[key]) map[key] = [];
      map[key].push(person);
    });
    return map;
  }, [people, interestIndex, influenceIndex]);

  // Layout positions within a cell — fixed avatar size, allow overlapping
  const getPositions = (count) => {
    if (count === 1) return [{ dx: 0, dy: 0 }];
    if (count === 2) return [{ dx: -12, dy: 0 }, { dx: 12, dy: 0 }];
    if (count === 3) return [{ dx: 0, dy: -10 }, { dx: -12, dy: 10 }, { dx: 12, dy: 10 }];
    if (count === 4) return [{ dx: -12, dy: -10 }, { dx: 12, dy: -10 }, { dx: -12, dy: 10 }, { dx: 12, dy: 10 }];
    // 5+: grid with slight overlap
    const positions = [];
    const ring = Math.ceil(Math.sqrt(count));
    const step = AVATAR_R * 1.6;
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

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const getRoleLabel = (value) => {
    if (!value || !roleOptions) return '';
    const opt = roleOptions.find((o) => o.value === value);
    return opt ? opt.label : value;
  };

  // Quadrant labels — standard stakeholder matrix:
  //   top-left:     high influence, low interest  = Zufriedenstellen
  //   top-right:    high influence, high interest  = Eng einbinden
  //   bottom-left:  low influence, low interest    = Beobachten
  //   bottom-right: low influence, high interest   = Informieren
  const quadrantLabels = useMemo(() => {
    if (cols < 2 || rows < 2) return [];
    const midCol = Math.floor(cols / 2);
    const midRow = Math.floor(rows / 2);
    // Quadranten-Texte aus der Config (stakeholder_quadrants); Fallback = Standard.
    const qLabel = (val, fallback) => (quadrantOptions || []).find((q) => q.value === val)?.label ?? fallback;
    return [
      { x: midCol / 2, y: midRow / 2, label: qLabel('hi_influence_lo_interest', 'Ausreichend informieren'), color: theme.colors.textMuted },
      { x: (cols + midCol) / 2, y: midRow / 2, label: qLabel('hi_influence_hi_interest', 'Regelmäßig informieren'), color: theme.colors.textMuted },
      { x: midCol / 2, y: (rows + midRow) / 2, label: qLabel('lo_influence_lo_interest', 'Gut informieren und einbeziehen'), color: theme.colors.textMuted },
      { x: (cols + midCol) / 2, y: (rows + midRow) / 2, label: qLabel('lo_influence_hi_interest', 'Umfangreich informieren und einbeziehen'), color: theme.colors.primary },
    ];
  }, [cols, rows, quadrantOptions]);

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      {people.length === 0 ? (
        <div style={{
          padding: theme.spacing['2xl'],
          textAlign: 'center',
          color: theme.colors.textMuted,
          fontSize: theme.typography.sizes.sm,
        }}>
          Keine Personen mit Interesse- und Einfluss-Werten vorhanden.
        </div>
      ) : (
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
        >
          {/* Background */}
          <rect
            x={PADDING.left}
            y={PADDING.top}
            width={gridW}
            height={gridH}
            fill={theme.colors.background}
            rx="4"
          />

          {/* Cell backgrounds with alternating tint */}
          {influenceReversed.map((_, rowIdx) =>
            interestOptions.map((_, colIdx) => (
              <rect
                key={`cell-${colIdx}-${rowIdx}`}
                x={PADDING.left + colIdx * cellW}
                y={PADDING.top + rowIdx * cellH}
                width={cellW}
                height={cellH}
                fill={(rowIdx + colIdx) % 2 === 0 ? theme.colors.surface : theme.colors.background}
                stroke={theme.colors.border}
                strokeWidth="0.5"
              />
            ))
          )}

          {/* Quadrant labels (watermark style) */}
          {quadrantLabels.map((q, i) => {
            const svgX = PADDING.left + q.x * cellW;
            const svgY = PADDING.top + (rows - q.y) * cellH;
            return (
              <text
                key={`ql-${i}`}
                x={svgX}
                y={svgY}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={q.color}
                fontSize="11"
                fontWeight="500"
                opacity="0.35"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {q.label}
              </text>
            );
          })}

          {/* X-axis labels (Interesse) — mehrzeilig für Lesbarkeit */}
          {interestOptions.map((opt, i) => {
            const cx = PADDING.left + i * cellW + cellW / 2;
            const lines = wrapLabel(opt.label, 12);
            return (
              <text
                key={`xl-${i}`}
                x={cx}
                y={PADDING.top + gridH + 16}
                textAnchor="middle"
                fill={theme.colors.textSecondary}
                fontSize="11"
                fontWeight="500"
              >
                {lines.map((ln, li) => (
                  <tspan key={li} x={cx} dy={li === 0 ? 0 : 12}>{ln}</tspan>
                ))}
              </text>
            );
          })}

          {/* X-axis title */}
          <text
            x={PADDING.left + gridW / 2}
            y={PADDING.top + gridH + 56}
            textAnchor="middle"
            fill={theme.colors.text}
            fontSize="12"
            fontWeight="600"
          >
            Interesse →
          </text>

          {/* Y-axis labels (Einfluss) - reversed so highest is at top */}
          {influenceReversed.map((opt, i) => (
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
            Einfluss →
          </text>

          {/* People avatars */}
          {Object.entries(cells).map(([key, group]) => {
            const [xi, yi] = key.split('-').map(Number);
            // yi is index in original (non-reversed) influence array
            // In SVG, row 0 is top, so flip
            const rowIdx = rows - 1 - yi;
            const cx = PADDING.left + xi * cellW + cellW / 2;
            const cy = PADDING.top + rowIdx * cellH + cellH / 2;
            const positions = getPositions(group.length);

            return group.map((person, pi) => {
              const px = cx + positions[pi].dx;
              const py = cy + positions[pi].dy;
              const initials = getInitials(person.name);

              return (
                <g
                  key={person.id || `${key}-${pi}`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (rect) {
                      const scale = rect.width / svgW;
                      setTooltip({
                        name: person.name || 'Unbenannt',
                        role: getRoleLabel(person.role),
                        type: person._type === 'team' ? 'Team' : 'Stakeholder',
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
                    r={AVATAR_R}
                    fill={theme.colors.primaryLight}
                    stroke={theme.colors.primary}
                    strokeWidth="2"
                  />
                  <text
                    x={px}
                    y={py}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={theme.colors.primary}
                    fontSize="11"
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
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          <div>{tooltip.name}</div>
          {tooltip.role && (
            <div style={{ opacity: 0.7, fontSize: '10px' }}>{tooltip.role} · {tooltip.type}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default StakeholderMatrix;
