/**
 * RoadmapShapes — gemeinsame Form-Symbolik fuer Meilensteine & Quality Gates.
 *
 * Konvention (Auftrag + Statusberichte, Formular + Timeline):
 *   - Meilenstein   → Raute (grün)
 *   - Quality Gate  → Schild (amber)
 *
 * In den Timelines werden die SVG-Helfer `diamondPoints`/`shieldPath` direkt
 * benutzt (mit positionsabhaengiger Farbe — im SB bleibt die Status-/Ampelfarbe).
 * In den Formularen werden die Badge-/Icon-Komponenten verwendet.
 */

import { theme } from '../../../config/theme';

export const MILESTONE_COLOR = theme.colors.success; // grün
export const GATE_COLOR = theme.colors.warning;      // amber

/** Punkte einer Raute (gedrehtes Quadrat) um (cx,cy) mit Halb-Diagonale r. */
export function diamondPoints(cx, cy, r) {
  return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
}

/** Pfad eines Schildes: flacher Kopf, gerade Seiten, unten zur Spitze gerundet. */
export function shieldPath(cx, cy, r) {
  const w = r;                       // Halbbreite am Kopf
  const top = cy - r;                // flache Oberkante
  const sideBottom = cy + r * 0.25;  // Ende der geraden Seiten
  const tip = cy + r * 1.15;         // untere Spitze
  return [
    `M ${cx - w} ${top}`,
    `L ${cx + w} ${top}`,
    `L ${cx + w} ${sideBottom}`,
    `Q ${cx + w} ${tip - r * 0.35} ${cx} ${tip}`,
    `Q ${cx - w} ${tip - r * 0.35} ${cx - w} ${sideBottom}`,
    'Z',
  ].join(' ');
}

// ---- Standalone-Icons (Formular-Sektion-Header, ohne Nummer) ----

export function MilestoneDiamondIcon({ size = 20, color = MILESTONE_COLOR }) {
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <polygon points={diamondPoints(c, c, c - 2)} fill={color} />
    </svg>
  );
}

export function QualityGateShieldIcon({ size = 20, color = GATE_COLOR }) {
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <path d={shieldPath(c, c - size * 0.05, c - 3)} fill={color} />
    </svg>
  );
}

// ---- Badges (Formular-Item, mit Nummer) ----

export function MilestoneBadge({ number, size = 32 }) {
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <polygon points={diamondPoints(c, c, c - 3)} fill={MILESTONE_COLOR} />
      <text
        x={c} y={c + 4} textAnchor="middle" fill="#fff"
        fontSize="12" fontWeight={theme.typography.weights.semibold}
        fontFamily={theme.typography.fontFamily}
      >
        {number}
      </text>
    </svg>
  );
}

export function QualityGateBadge({ number, size = 32 }) {
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <path d={shieldPath(c, c - 1, c - 4)} fill={GATE_COLOR} />
      <text
        x={c} y={c + 3} textAnchor="middle" fill="#fff"
        fontSize="12" fontWeight={theme.typography.weights.semibold}
        fontFamily={theme.typography.fontFamily}
      >
        {number}
      </text>
    </svg>
  );
}
