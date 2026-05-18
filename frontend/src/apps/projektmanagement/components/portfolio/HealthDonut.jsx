/**
 * HealthDonut — kompakter SVG-Donut fuer Health-Ampel-Mix
 * (gruen/gelb/rot/unbekannt) im Portfolio-Dashboard.
 *
 * Render-only-Komponente; alle Werte kommen vom Backend-Aggregator.
 */

import { theme } from '../../../../config/theme';

const COLORS = {
  gruen: theme.colors.success,
  gelb: theme.colors.warning,
  rot: theme.colors.error,
  unbekannt: theme.colors.textMuted,
};

const LABELS = {
  gruen: 'Grün',
  gelb: 'Gelb',
  rot: 'Rot',
  unbekannt: 'Unbekannt',
};

export default function HealthDonut({ health, size = 120, thickness = 16 }) {
  const total = (health?.gruen || 0) + (health?.gelb || 0) + (health?.rot || 0) + (health?.unbekannt || 0);
  const radius = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = total > 0
    ? ['gruen', 'gelb', 'rot', 'unbekannt']
        .filter((k) => (health?.[k] || 0) > 0)
        .map((k) => ({ key: k, value: health[k] }))
    : [];

  let offsetSoFar = 0;
  const arcs = segments.map((s) => {
    const fraction = s.value / total;
    const dasharray = `${fraction * circumference} ${circumference - fraction * circumference}`;
    const dashoffset = -offsetSoFar;
    offsetSoFar += fraction * circumference;
    return { key: s.key, dasharray, dashoffset };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.lg }}>
      <svg width={size} height={size} role="img" aria-label="Health-Verteilung">
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="transparent"
          stroke={theme.colors.surfaceHover}
          strokeWidth={thickness}
        />
        {arcs.map((a) => (
          <circle
            key={a.key}
            cx={cx}
            cy={cy}
            r={radius}
            fill="transparent"
            stroke={COLORS[a.key]}
            strokeWidth={thickness}
            strokeDasharray={a.dasharray}
            strokeDashoffset={a.dashoffset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          style={{
            fontSize: 24,
            fontWeight: 600,
            fill: theme.colors.text,
            fontFamily: 'inherit',
          }}
        >
          {total}
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
        {['gruen', 'gelb', 'rot', 'unbekannt'].map((k) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, fontSize: theme.typography.sizes.sm }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: COLORS[k], flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: theme.colors.text, minWidth: 24, textAlign: 'right' }}>
              {health?.[k] || 0}
            </span>
            <span style={{ color: theme.colors.textSecondary }}>{LABELS[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
