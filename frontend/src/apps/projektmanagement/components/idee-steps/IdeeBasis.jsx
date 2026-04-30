/**
 * IdeeBasis — Tab 1 des Projektidee-Wizards.
 * Felder: Projekt-ID, Projektname, Projekttyp, Projektidee Status, Projektstatus,
 * Projekttreiber, Projektgröße, Priorität, Kurzbeschreibung, Start/End-Datum,
 * Projektleiter, Auftraggeber.
 */

import { theme } from '../../../../config/theme';

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: theme.spacing.xl },
  header: { marginBottom: theme.spacing.lg },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: { fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.lg },
  formGroup: { display: 'flex', flexDirection: 'column', gap: theme.spacing.sm },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  required: { color: theme.colors.error, marginLeft: '2px' },
  input: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
  },
  select: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    cursor: 'pointer',
    outline: 'none',
  },
  textarea: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    minHeight: '100px',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  hint: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
};

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Entwurf' },
  { value: 'review', label: 'In Pruefung' },
  { value: 'approved', label: 'Genehmigt' },
  { value: 'rejected', label: 'Abgelehnt' },
  { value: 'archived', label: 'Archiviert' },
];

const PROJECT_TYPE_OPTIONS = [
  { value: '', label: '— Bitte auswählen —' },
  { value: 'internal', label: 'Internes Projekt' },
  { value: 'external', label: 'Externes Projekt' },
  { value: 'research', label: 'Forschungsprojekt' },
  { value: 'infrastructure', label: 'Infrastrukturprojekt' },
];

const PROJEKTGROESSE_OPTIONS = [
  { value: '', label: '— Bitte auswählen —' },
  { value: 'klein', label: 'Klein' },
  { value: 'mittel', label: 'Mittel' },
  { value: 'gross', label: 'Groß' },
  { value: 'sehr_gross', label: 'Sehr groß' },
];

const PRIORITAET_OPTIONS = [
  { value: '', label: '— Bitte auswählen —' },
  { value: 'low', label: 'Niedrig' },
  { value: 'medium', label: 'Mittel' },
  { value: 'high', label: 'Hoch' },
  { value: 'critical', label: 'Kritisch' },
];

export default function IdeeBasis({ projektidee, onChange }) {
  const update = (field, value) => onChange({ ...projektidee, [field]: value });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>1. Basisdaten</h2>
        <p style={styles.subtitle}>Erfassen Sie die grundlegenden Informationen zur Projektidee.</p>
      </div>

      <div style={styles.grid}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Projekt-ID</label>
          <input
            type="text"
            style={styles.input}
            placeholder="z.B. PRJ-2026-001"
            value={projektidee.projekt_id || ''}
            onChange={(e) => update('projekt_id', e.target.value)}
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Projektname<span style={styles.required}>*</span>
          </label>
          <input
            type="text"
            style={styles.input}
            placeholder="z.B. Einführung neues CRM-System"
            value={projektidee.name || ''}
            onChange={(e) => update('name', e.target.value)}
            required
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Projekttyp</label>
          <select
            style={styles.select}
            value={projektidee.project_type || ''}
            onChange={(e) => update('project_type', e.target.value)}
          >
            {PROJECT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Projektidee Status</label>
          <select
            style={styles.select}
            value={projektidee.status || 'draft'}
            onChange={(e) => update('status', e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Projektstatus</label>
          <input
            type="text"
            style={styles.input}
            placeholder="z.B. Konzeption, Pruefung, Skizze..."
            value={projektidee.project_status || ''}
            onChange={(e) => update('project_status', e.target.value)}
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Projekttreiber</label>
          <input
            type="text"
            style={styles.input}
            placeholder="Wer/was treibt die Idee?"
            value={projektidee.projekttreiber || ''}
            onChange={(e) => update('projekttreiber', e.target.value)}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Projektgröße</label>
          <select
            style={styles.select}
            value={projektidee.projektgroesse || ''}
            onChange={(e) => update('projektgroesse', e.target.value)}
          >
            {PROJEKTGROESSE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Priorität</label>
          <select
            style={styles.select}
            value={projektidee.prioritaet || ''}
            onChange={(e) => update('prioritaet', e.target.value)}
          >
            {PRIORITAET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Kurzbeschreibung</label>
        <textarea
          style={styles.textarea}
          placeholder="Beschreiben Sie die Idee in wenigen Sätzen..."
          value={projektidee.description || ''}
          onChange={(e) => update('description', e.target.value)}
        />
      </div>

      <div style={styles.grid}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Startdatum</label>
          <input
            type="date"
            style={styles.input}
            value={projektidee.start_date || ''}
            onChange={(e) => update('start_date', e.target.value)}
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Enddatum</label>
          <input
            type="date"
            style={styles.input}
            value={projektidee.end_date || ''}
            onChange={(e) => update('end_date', e.target.value)}
          />
          <span style={styles.hint}>Optional bei unbefristeten Ideen</span>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Projektleiter</label>
          <input
            type="text"
            style={styles.input}
            placeholder="Name des Projektleiters"
            value={projektidee.projektleiter || ''}
            onChange={(e) => update('projektleiter', e.target.value)}
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Auftraggeber</label>
          <input
            type="text"
            style={styles.input}
            placeholder="Name des Auftraggebers"
            value={projektidee.auftraggeber || ''}
            onChange={(e) => update('auftraggeber', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
