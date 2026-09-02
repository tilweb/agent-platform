/**
 * ResourceCard — kompakte Einheitskachel für alle Übersichtsseiten (Agenten,
 * Skills, Knowledge Base, Tabellen). Bewusst dicht: Icon, Titel (+ optionaler
 * Accessory wie RoleBadge), kleine Meta-Zeile, auf 2 Zeilen geklemmte Beschreibung
 * und eine Badge-Reihe (max. `maxBadges` + „+N"). Gesperrte Ressourcen werden
 * ausgegraut und sind nicht klickbar.
 *
 * Props:
 *   icon: ReactNode           — bereits gefärbtes Icon-Element
 *   iconBg, iconColor: string — Hintergrund/Vordergrund der Icon-Fläche
 *   title: string
 *   titleAccessory: ReactNode — z. B. <RoleBadge/>
 *   meta: ReactNode           — kleine Zeile über der Beschreibung (z. B. "id · v1.0" / "3 Dokumente")
 *   description: string       — auf 2 Zeilen geklemmt
 *   badges: [{ label, variant }]
 *   maxBadges: number         — default 3
 *   locked: bool
 *   lockedHint: string        — z. B. "Zugriff anfragen bei Gruppe X"
 *   footerAction: ReactNode   — rechte Aktion im Footer (z. B. Edit-Button)
 *   onClick: () => void
 */

import { useState } from 'react';
import { theme } from '../../config/theme';
import { LockIcon } from '../Icons';
import Badge from './Badge';

export function CardGrid({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: theme.spacing.md, alignItems: 'stretch' }}>
      {children}
    </div>
  );
}

const styles = {
  card: {
    position: 'relative',
    display: 'flex', flexDirection: 'column',
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    transition: `all ${theme.transitions.fast}`,
    height: '100%',
    boxSizing: 'border-box',
  },
  cardHover: { borderColor: theme.colors.primary, boxShadow: theme.shadows.md },
  cardLocked: { opacity: 0.6, backgroundColor: theme.colors.background, cursor: 'default' },
  header: { display: 'flex', alignItems: 'flex-start', gap: theme.spacing.md, marginBottom: theme.spacing.sm },
  iconBox: { width: 32, height: 32, borderRadius: theme.borderRadius.md, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titleWrap: { minWidth: 0, flex: 1 },
  titleRow: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' },
  title: { fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, overflow: 'hidden', textOverflow: 'ellipsis' },
  meta: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  desc: {
    fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.normal, margin: `${theme.spacing.xs} 0 0`,
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
    minHeight: '2.6em',
  },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm, marginTop: 'auto', paddingTop: theme.spacing.md },
  badges: { display: 'flex', alignItems: 'center', gap: theme.spacing.xs, flexWrap: 'wrap', minWidth: 0 },
  lockIcon: { position: 'absolute', top: theme.spacing.md, right: theme.spacing.md, color: theme.colors.textMuted },
  lockedHint: { fontStyle: 'italic', color: theme.colors.textMuted, fontSize: theme.typography.sizes.xs },
};

export default function ResourceCard({
  icon, iconBg, title, titleAccessory, meta, description,
  badges = [], maxBadges = 3, locked = false, lockedHint, footerAction, onClick,
}) {
  const [hover, setHover] = useState(false);
  const clickable = !locked && typeof onClick === 'function';
  const shown = badges.slice(0, maxBadges);
  const extra = badges.length - shown.length;

  return (
    <div
      style={{
        ...styles.card,
        ...(hover && clickable ? styles.cardHover : {}),
        ...(locked ? styles.cardLocked : {}),
        cursor: clickable ? 'pointer' : 'default',
      }}
      onClick={clickable ? onClick : undefined}
      onMouseEnter={() => clickable && setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={locked ? lockedHint : undefined}
    >
      {locked && <div style={styles.lockIcon}><LockIcon size={16} /></div>}

      <div style={styles.header}>
        <div style={{ ...styles.iconBox, backgroundColor: locked ? theme.colors.surfaceHover : (iconBg || theme.colors.surfaceHover) }}>
          {icon}
        </div>
        <div style={styles.titleWrap}>
          <div style={styles.titleRow}>
            <span style={styles.title}>{title}</span>
            {!locked && titleAccessory}
          </div>
          {meta && <div style={styles.meta}>{meta}</div>}
        </div>
      </div>

      {!locked && description ? <p style={styles.desc}>{description}</p> : null}

      {locked ? (
        <div style={styles.footer}><span style={styles.lockedHint}>{lockedHint}</span></div>
      ) : (shown.length > 0 || footerAction) ? (
        <div style={styles.footer}>
          <div style={styles.badges}>
            {shown.map((b, i) => <Badge key={i} variant={b.variant}>{b.label}</Badge>)}
            {extra > 0 && <Badge variant="muted">+{extra}</Badge>}
          </div>
          {footerAction}
        </div>
      ) : null}
    </div>
  );
}
