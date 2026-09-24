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
  // Pulsierender KI-Punkt rechts neben dem Titel — auch bei eingeklapptem Block sichtbar.
  headlineDot: { display: 'inline-block', width: 8, height: 8, borderRadius: theme.borderRadius.full, backgroundColor: ACCENT, flexShrink: 0, animation: 'wg-pulse 1.6s ease-in-out infinite' },
};

/**
 * Sektion mit Titel + optionaler Ampel „n offen" (abgeleitet aus offenen Prüfschritten).
 * offenCount = Anzahl offener zugehöriger Prüfschritte (0 = grün/ok).
 * Optional einklappbar (collapsible + defaultOpen) — Zustand lokal, Chevron im Titel.
 * `unbestaetigt` = true → pulsierender KI-Punkt neben dem Titel (≥1 offener KI-Vorschlag im Block).
 * `ungeprueft` = true → der Vorgang wurde noch nie geprüft: neutrale Marke „nicht geprüft" statt
 * Grün — ohne Prüflauf gibt es keine offenen Punkte, das heißt aber nicht „vollständig".
 */
export default function SektionCard({ title, offenCount, onOffenClick, action, children, collapsible = false, defaultOpen = true, notizCount, onNotizClick, unbestaetigt = false, ungeprueft = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const hasOpen = !ungeprueft && offenCount > 0;
  const ampelStyle = ungeprueft
    ? { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted }
    : hasOpen
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
          {unbestaetigt && (
            <span style={styles.headlineDot} title="Enthält unbestätigte KI-Vorschläge" aria-label="Unbestätigte KI-Vorschläge" />
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
              <span style={{ ...styles.ampel, ...ampelStyle }} title={ungeprueft ? 'Für diesen Vorgang wurde noch keine Prüfung ausgeführt.' : undefined}>
                {ungeprueft ? 'nicht geprüft' : hasOpen ? `${offenCount} offen` : 'vollständig'}
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

/**
 * Kleines Feld-Grid (Label/Wert) für Detailsektionen.
 * `dot`  = optionaler Node vor dem Label (KI-Punkt am Zeilenanfang, FeldStatusDot).
 * `mark` = optionaler Node hinter dem Wert (Freigabe ✓/✗, FeldStatusFreigabe).
 * Jede Zeile bekommt eine dünne Trennlinie (borderLight), die letzte Zeile nicht.
 */
export function FeldGrid({ felder }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr', columnGap: theme.spacing.lg }}>
      {felder.map((f, i) => (
        <FeldZeile key={f.label} label={f.label} value={f.value} mark={f.mark} dot={f.dot} last={i === felder.length - 1} />
      ))}
    </div>
  );
}

export function FeldZeile({ label, value, mark, dot, last = false }) {
  const cell = {
    fontSize: theme.typography.sizes.sm,
    padding: `${theme.spacing.sm} 0`,
    borderBottom: last ? 'none' : `1px solid ${theme.colors.borderLight}`,
  };
  return (
    <>
      <div style={{ ...cell, color: theme.colors.textMuted, display: 'flex', alignItems: 'center', gap: theme.spacing.xs }}>
        {dot}{label}
      </div>
      <div style={{ ...cell, color: theme.colors.text }}>{value ?? '—'}{mark}</div>
    </>
  );
}

export { ACCENT };
