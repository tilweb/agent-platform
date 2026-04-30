/**
 * Projektkontext — Tab 3 des Projektidee-Wizards.
 * Zwei freie Textfelder: Ausgangslage (warum/wofuer) und Rahmenbedingungen.
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
  textarea: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    minHeight: '140px',
    resize: 'vertical',
    fontFamily: theme.typography.fontFamily,
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
};

export default function Projektkontext({ projektidee, onChange }) {
  const ctx = projektidee.context ?? { ausgangslage: '', rahmenbedingungen: '' };
  const update = (field, value) =>
    onChange({ ...projektidee, context: { ...ctx, [field]: value } });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>3. Projektkontext</h2>
        <p style={styles.subtitle}>
          Beschreiben Sie das Umfeld, in dem die Idee entstanden ist und realisiert werden soll.
        </p>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Ausgangslage</label>
        <textarea
          value={ctx.ausgangslage || ''}
          onChange={(e) => update('ausgangslage', e.target.value)}
          placeholder="Warum und in welchem Rahmen ist die Projektidee entstanden? Welches Problem wird adressiert?"
          style={styles.textarea}
          onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
          onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
        />
        <p style={styles.hint}>
          Auslöser, Motivation, strategischer Bezug, betroffene Bereiche.
        </p>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Rahmenbedingungen</label>
        <textarea
          value={ctx.rahmenbedingungen || ''}
          onChange={(e) => update('rahmenbedingungen', e.target.value)}
          placeholder="Von welchen Faktoren ist die Projektidee abhaengig? Welche Constraints gibt es?"
          style={styles.textarea}
          onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
          onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
        />
        <p style={styles.hint}>
          Budget-Rahmen, Termine, regulatorische Vorgaben, technische Voraussetzungen, Abhängigkeiten zu anderen Projekten.
        </p>
      </div>
    </div>
  );
}
