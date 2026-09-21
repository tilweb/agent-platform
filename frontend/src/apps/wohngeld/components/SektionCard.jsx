import { useState } from 'react';
import { theme } from '../../../config/theme';
import { ChevronDownIcon, CommentIcon } from '../../../components/Icons';
import { ACCENT } from '../api';

const styles = {
  card: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  titleWrap: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, minWidth: 0 },
  titleBtn: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: theme.colors.text },
  title: { fontSize: theme.typography.sizes.md, fontWeight: theme.typography.weights.semibold, color: theme.colors.text },
  chevron: { transition: `transform ${theme.transitions.fast}`, flexShrink: 0, color: theme.colors.textMuted },
  right: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm },
  ampel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
  },
  notizBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 3,
    padding: `2px ${theme.spacing.sm}`, background: 'none',
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.full,
    color: theme.colors.textMuted, cursor: 'pointer', fontSize: theme.typography.sizes.xs,
  },
};

/**
 * Sektion mit Titel + optionaler Ampel „n offen" (abgeleitet aus offenen Prüfschritten).
 * offenCount = Anzahl offener zugehöriger Prüfschritte (0 = grün/ok).
 * Optional einklappbar (collapsible + defaultOpen) — Zustand lokal, Chevron im Titel.
 */
export default function SektionCard({ title, offenCount, onOffenClick, action, children, collapsible = false, defaultOpen = true, notizCount, onNotizClick }) {
  const [open, setOpen] = useState(defaultOpen);
  const hasOpen = offenCount > 0;
  const ampelStyle = hasOpen
    ? { backgroundColor: theme.colors.warningLight, color: theme.colors.warning }
    : { backgroundColor: theme.colors.successLight, color: theme.colors.success };
  const showBody = !collapsible || open;
  return (
    <div style={styles.card}>
      <div style={{ ...styles.head, marginBottom: showBody ? theme.spacing.md : 0 }}>
        <div style={styles.titleWrap}>
          {collapsible ? (
            <button
              style={styles.titleBtn}
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              title={open ? 'Einklappen' : 'Ausklappen'}
            >
              <ChevronDownIcon size={16} style={{ ...styles.chevron, transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
              <span style={styles.title}>{title}</span>
            </button>
          ) : (
            <div style={styles.title}>{title}</div>
          )}
        </div>
        <div style={styles.right}>
          {typeof offenCount === 'number' && (
            hasOpen && onOffenClick ? (
              <button
                type="button"
                style={{ ...styles.ampel, ...ampelStyle, border: 'none', cursor: 'pointer' }}
                onClick={onOffenClick}
                title="Offene Punkte anzeigen"
              >
                {offenCount} offen
              </button>
            ) : (
              <span style={{ ...styles.ampel, ...ampelStyle }}>
                {hasOpen ? `${offenCount} offen` : 'vollständig'}
              </span>
            )
          )}
          {onNotizClick && (
            <button style={styles.notizBtn} onClick={onNotizClick} title="Notizen">
              <CommentIcon size={13} />
              {notizCount > 0 && <span>{notizCount}</span>}
            </button>
          )}
          {action}
        </div>
      </div>
      {showBody && children}
    </div>
  );
}

/** Kleines Feld-Grid (Label/Wert) für Detailsektionen. `mark` = optionaler Node hinter dem Wert (z. B. FeldStatusMark). */
export function FeldGrid({ felder }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr', rowGap: theme.spacing.sm, columnGap: theme.spacing.lg }}>
      {felder.map((f) => (
        <FeldZeile key={f.label} label={f.label} value={f.value} mark={f.mark} />
      ))}
    </div>
  );
}

export function FeldZeile({ label, value, mark }) {
  return (
    <>
      <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>{label}</div>
      <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text }}>{value ?? '—'}{mark}</div>
    </>
  );
}

export { ACCENT };
