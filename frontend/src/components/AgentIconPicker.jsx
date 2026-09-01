/**
 * AgentIconPicker — Modal zur Auswahl von Icon + Farbe eines Agenten.
 * Feste Auswahl aus AGENT_ICONS + AGENT_COLORS. Übernimmt die Auswahl erst
 * beim Klick auf „Übernehmen".
 */

import { useState } from 'react';
import { theme } from '../config/theme';
import { AGENT_ICONS, AGENT_COLORS, DEFAULT_AGENT_ICON, DEFAULT_AGENT_COLOR } from './agentIcons';
import { AgentAvatar, AgentGlyph } from './AgentAvatar';

const styles = {
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: theme.spacing.lg,
  },
  modal: {
    backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`, boxShadow: theme.shadows.xl,
    width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto',
    padding: theme.spacing.xl, display: 'flex', flexDirection: 'column', gap: theme.spacing.lg,
  },
  head: { display: 'flex', alignItems: 'center', gap: theme.spacing.lg },
  title: { fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, margin: 0 },
  sub: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, margin: 0 },
  sectionLabel: {
    fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: theme.spacing.sm,
  },
  iconGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))', gap: theme.spacing.sm },
  iconBtn: {
    aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface, cursor: 'pointer', transition: `all ${theme.transitions.fast}`,
  },
  colorRow: { display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm },
  swatch: {
    width: 30, height: 30, borderRadius: theme.borderRadius.full, cursor: 'pointer',
    border: '2px solid transparent', transition: `all ${theme.transitions.fast}`,
  },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  btn: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`, borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer',
  },
  btnSecondary: { backgroundColor: 'transparent', color: theme.colors.text, border: `1px solid ${theme.colors.border}` },
  btnPrimary: { backgroundColor: theme.colors.primary, color: '#fff', border: 'none' },
};

export default function AgentIconPicker({ icon, color, onApply, onClose }) {
  const [selIcon, setSelIcon] = useState(icon || DEFAULT_AGENT_ICON);
  const [selColor, setSelColor] = useState(color || DEFAULT_AGENT_COLOR);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.head}>
          <AgentAvatar icon={selIcon} color={selColor} size={56} />
          <div>
            <h3 style={styles.title}>Icon &amp; Farbe wählen</h3>
            <p style={styles.sub}>Gib dem Agenten ein wiedererkennbares Symbol.</p>
          </div>
        </div>

        <div>
          <div style={styles.sectionLabel}>Icon</div>
          <div style={styles.iconGrid}>
            {AGENT_ICONS.map(({ id, label }) => {
              const active = id === selIcon;
              return (
                <button
                  key={id}
                  type="button"
                  title={label}
                  onClick={() => setSelIcon(id)}
                  style={{
                    ...styles.iconBtn,
                    ...(active ? { borderColor: selColor, backgroundColor: `${selColor}18` } : {}),
                  }}
                >
                  <AgentGlyph icon={id} size={20} color={active ? selColor : theme.colors.textSecondary} />
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div style={styles.sectionLabel}>Farbe</div>
          <div style={styles.colorRow}>
            {AGENT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setSelColor(c)}
                style={{
                  ...styles.swatch,
                  backgroundColor: c,
                  ...(c === selColor ? { borderColor: theme.colors.text, transform: 'scale(1.12)' } : {}),
                }}
              />
            ))}
          </div>
        </div>

        <div style={styles.footer}>
          <button type="button" style={{ ...styles.btn, ...styles.btnSecondary }} onClick={onClose}>Abbrechen</button>
          <button type="button" style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => onApply({ icon: selIcon, color: selColor })}>Übernehmen</button>
        </div>
      </div>
    </div>
  );
}
