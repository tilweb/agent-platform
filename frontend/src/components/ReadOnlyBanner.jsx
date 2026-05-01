/**
 * ReadOnlyBanner — Hinweis-Banner in Detail-Ansichten wenn der User nur
 * lesen darf. Beantwortet die Frage "warum kann ich hier nichts speichern?"
 * und nennt den Owner als Anlaufstelle fuer Bearbeitungsrechte.
 *
 * Wird vom Aufrufer konditional gerendert — die Komponente selbst checkt
 * keine Rolle. Aufrufer rendert sie wenn `role === 'viewer'` o.ae.
 */

import { theme } from '../config/theme';

const styles = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.lg,
  },
  icon: {
    flexShrink: 0,
  },
};

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={styles.icon}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

/**
 * @param {{ ownerName?: string, message?: string, style?: object }} props
 *
 * Default-Message: "Lesezugriff. Anfrage fuer Bearbeitungsrechte an <Owner>."
 * `message` ueberschreibt fuer spezifische Faelle (z.B. "Sie sind nicht
 * berechtigt zu loeschen — nur der Owner kann das.").
 */
export default function ReadOnlyBanner({ ownerName, message, style = {} }) {
  const text = message
    ?? (ownerName
      ? `Sie haben Lesezugriff. Anfrage fuer Bearbeitungsrechte an ${ownerName}.`
      : 'Sie haben Lesezugriff.');
  return (
    <div style={{ ...styles.banner, ...style }}>
      <InfoIcon />
      <span>{text}</span>
    </div>
  );
}
