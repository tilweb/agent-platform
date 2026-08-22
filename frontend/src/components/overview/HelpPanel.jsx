/**
 * HelpPanel — ausklappbares Erklär-Panel unter dem Seitenkopf. Kundengerechter
 * Klartext, KEINE erfundenen externen Doku-Links (nur optionale interne CTAs).
 *
 * Props:
 *   open: bool
 *   title: string
 *   paragraphs: string[]           — Fließtext-Absätze
 *   points: [{ term, desc }]       — optionale Begriffsliste (z. B. Gruppen erklärt)
 *   footer: ReactNode              — optionaler CTA/Link (intern)
 */

import { theme } from '../../config/theme';
import { HelpCircleIcon } from '../Icons';

const styles = {
  panel: {
    backgroundColor: theme.colors.infoLight,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    display: 'flex',
    gap: theme.spacing.md,
  },
  iconCol: { color: theme.colors.info, flexShrink: 0, marginTop: 2 },
  body: { display: 'flex', flexDirection: 'column', gap: theme.spacing.sm, minWidth: 0 },
  title: { fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text },
  para: { fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, lineHeight: theme.typography.lineHeight.relaxed, margin: 0 },
  points: { display: 'flex', flexDirection: 'column', gap: theme.spacing.xs, margin: 0, paddingLeft: 0, listStyle: 'none' },
  point: { fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary },
  term: { fontWeight: theme.typography.weights.semibold, color: theme.colors.text },
  footer: { marginTop: theme.spacing.xs },
};

export default function HelpPanel({ open, title, paragraphs = [], points = [], footer }) {
  if (!open) return null;
  return (
    <div style={styles.panel}>
      <div style={styles.iconCol}><HelpCircleIcon size={18} /></div>
      <div style={styles.body}>
        {title && <div style={styles.title}>{title}</div>}
        {paragraphs.map((p, i) => <p key={i} style={styles.para}>{p}</p>)}
        {points.length > 0 && (
          <ul style={styles.points}>
            {points.map((pt, i) => (
              <li key={i} style={styles.point}><span style={styles.term}>{pt.term}:</span> {pt.desc}</li>
            ))}
          </ul>
        )}
        {footer && <div style={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
