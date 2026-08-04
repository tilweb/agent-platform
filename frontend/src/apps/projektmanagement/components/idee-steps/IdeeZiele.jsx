/**
 * IdeeZiele — Tab 2 des Projektidee-Wizards.
 * Schlanker als Auftrag-Ziele: nur Projektziele (keine Erfolgskriterien — die folgen erst im Auftrag).
 */

import { theme } from '../../../../config/theme';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  required: {
    color: theme.colors.error,
    marginLeft: '2px',
  },
  textarea: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    minHeight: '180px',
    resize: 'vertical',
    fontFamily: theme.typography.fontFamily,
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  tipBox: {
    backgroundColor: theme.colors.infoLight,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.lg,
  },
  tipTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.info,
    marginBottom: theme.spacing.sm,
  },
  tipText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    lineHeight: theme.typography.lineHeight.relaxed,
  },
};

export default function IdeeZiele({ projektidee, onChange }) {
  const update = (value) => onChange({ ...projektidee, goals: value });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Ziele</h2>
        <p style={styles.subtitle}>
          Skizzieren Sie die Ziele der Projektidee. Erfolgskriterien folgen spaeter im Projektauftrag.
        </p>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>
          Projektziele<span style={styles.required}>*</span>
        </label>
        <textarea
          value={projektidee.goals || ''}
          onChange={(e) => update(e.target.value)}
          placeholder="Beschreiben Sie die Ziele der Idee...

Beispiel:
- 80% Reduktion manueller Sichtungsaufwand im HR
- Konsistente Bewertungskriterien fuer Bewerber
- Schnellere Time-to-Interview"
          style={styles.textarea}
          onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
          onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
        />
        <p style={styles.hint}>
          In der Ideen-Phase reicht eine grobe Vision. Detaillierte SMART-Ziele und messbare
          Erfolgskriterien werden im Projektauftrag ausgearbeitet.
        </p>
      </div>

      <div style={styles.tipBox}>
        <div style={styles.tipTitle}>Tipp: Was ist eine gute Idee-Vision?</div>
        <p style={styles.tipText}>
          Beschreiben Sie das <strong>"Warum"</strong> und das angestrebte <strong>Outcome</strong>,
          nicht die konkrete Loesung. Beispiel: "Wir wollen die Bewerbersichtung automatisieren,
          damit HR sich auf wertschoepfende Gespraeche konzentrieren kann" — nicht "Wir bauen
          ein LLM-System mit Function-Calling auf Postgres".
        </p>
      </div>
    </div>
  );
}
