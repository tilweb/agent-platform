/**
 * Step1Basis - Basisdaten des Projektauftrags
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
    color: theme.colors.textMuted,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.lg,
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
  input: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    transition: `border-color ${theme.transitions.fast}`,
  },
  textarea: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    minHeight: '100px',
    resize: 'vertical',
    fontFamily: theme.typography.fontFamily,
  },
  select: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    cursor: 'pointer',
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
};

function Step1Basis({ data, onChange }) {
  const handleChange = (field, value) => {
    onChange({ [field]: value });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>1. Basisdaten</h2>
        <p style={styles.subtitle}>
          Erfassen Sie die grundlegenden Informationen zum Projektauftrag.
        </p>
      </div>

      {/* Projektname */}
      <div style={styles.formGroup}>
        <label style={styles.label}>
          Projektname<span style={styles.required}>*</span>
        </label>
        <input
          type="text"
          value={data.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="z.B. Einführung neues CRM-System"
          style={styles.input}
          onFocus={(e) => {
            e.target.style.borderColor = theme.colors.primary;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = theme.colors.border;
          }}
        />
      </div>

      {/* Projekttyp und Beschreibung */}
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Projekttyp</label>
          <select
            value={data.project_type || 'internal'}
            onChange={(e) => handleChange('project_type', e.target.value)}
            style={styles.select}
          >
            <option value="internal">Internes Projekt</option>
            <option value="external">Externes Projekt</option>
            <option value="research">Forschungsprojekt</option>
            <option value="infrastructure">Infrastrukturprojekt</option>
          </select>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Status</label>
          <select
            value={data.status || 'draft'}
            onChange={(e) => handleChange('status', e.target.value)}
            style={styles.select}
          >
            <option value="draft">Entwurf</option>
            <option value="active">Aktiv</option>
            <option value="completed">Abgeschlossen</option>
            <option value="cancelled">Abgebrochen</option>
          </select>
        </div>
      </div>

      {/* Beschreibung */}
      <div style={styles.formGroup}>
        <label style={styles.label}>Kurzbeschreibung</label>
        <textarea
          value={data.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Beschreiben Sie das Projekt in wenigen Sätzen..."
          style={styles.textarea}
          onFocus={(e) => {
            e.target.style.borderColor = theme.colors.primary;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = theme.colors.border;
          }}
        />
      </div>

      {/* Zeitraum */}
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Startdatum<span style={styles.required}>*</span>
          </label>
          <input
            type="date"
            value={data.start_date || ''}
            onChange={(e) => handleChange('start_date', e.target.value)}
            style={styles.input}
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Enddatum</label>
          <input
            type="date"
            value={data.end_date || ''}
            onChange={(e) => handleChange('end_date', e.target.value)}
            style={styles.input}
          />
          <p style={styles.hint}>Optional bei unbefristeten Projekten</p>
        </div>
      </div>

      {/* Verantwortliche */}
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Projektleiter<span style={styles.required}>*</span>
          </label>
          <input
            type="text"
            value={data.projektleiter || ''}
            onChange={(e) => handleChange('projektleiter', e.target.value)}
            placeholder="Name des Projektleiters"
            style={styles.input}
            onFocus={(e) => {
              e.target.style.borderColor = theme.colors.primary;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = theme.colors.border;
            }}
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Auftraggeber<span style={styles.required}>*</span>
          </label>
          <input
            type="text"
            value={data.auftraggeber || ''}
            onChange={(e) => handleChange('auftraggeber', e.target.value)}
            placeholder="Name des Auftraggebers"
            style={styles.input}
            onFocus={(e) => {
              e.target.style.borderColor = theme.colors.primary;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = theme.colors.border;
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default Step1Basis;
