/**
 * PhaseMixBar — Stacked-Bar fuer Projekt-Phase-Verteilung im Portfolio.
 *
 * Eine Bar, 5 farbige Segmente proportional zum Anteil. Labels mit Counts
 * direkt unter der Bar.
 */

import { theme } from '../../../../config/theme';

const SEGMENT_ORDER = [
  { key: 'initiation', color: theme.colors.textMuted, label: 'Initiierung' },
  { key: 'planning', color: theme.colors.primary, label: 'Planung' },
  { key: 'execution', color: theme.colors.warning, label: 'Umsetzung' },
  { key: 'closing', color: theme.colors.success, label: 'Abschluss' },
  { key: 'stopped', color: theme.colors.error, label: 'Gestoppt' },
  { key: 'unbekannt', color: theme.colors.surfaceHover, label: '—' },
];

export default function PhaseMixBar({ mix }) {
  const total = SEGMENT_ORDER.reduce((s, seg) => s + (mix?.[seg.key] || 0), 0);

  if (total === 0) {
    return (
      <div style={{
        padding: theme.spacing.lg,
        fontSize: theme.typography.sizes.sm,
        color: theme.colors.textMuted,
        fontStyle: 'italic',
        textAlign: 'center',
      }}>
        Keine Projekte mit Phase-Status zugeordnet.
      </div>
    );
  }

  // Pro Segment den Anteil ausrechnen.
  const segments = SEGMENT_ORDER.map((seg) => {
    const value = mix?.[seg.key] || 0;
    const pct = (value / total) * 100;
    return { ...seg, value, pct };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      {/* Bar */}
      <div style={{
        display: 'flex',
        height: 24,
        borderRadius: theme.borderRadius.md,
        overflow: 'hidden',
        backgroundColor: theme.colors.surfaceHover,
      }}>
        {segments.filter((s) => s.value > 0).map((s) => (
          <div
            key={s.key}
            title={`${s.label}: ${s.value}`}
            style={{
              width: `${s.pct}%`,
              backgroundColor: s.color,
              transition: `width ${theme.transitions.fast}`,
            }}
          />
        ))}
      </div>

      {/* Legende */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: theme.spacing.sm,
      }}>
        {segments.filter((s) => s.value > 0).map((s) => (
          <div key={s.key} style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm,
            fontSize: theme.typography.sizes.sm,
          }}>
            <span style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: s.color,
              flexShrink: 0,
            }} />
            <span style={{ fontWeight: 600, color: theme.colors.text, minWidth: 24, textAlign: 'right' }}>
              {s.value}
            </span>
            <span style={{ color: theme.colors.textSecondary }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
