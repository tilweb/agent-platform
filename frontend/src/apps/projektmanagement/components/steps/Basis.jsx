/**
 * Basis - Basisdaten des Projektauftrags
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

function Basis({ data, onChange, config }) {
  const handleChange = (field, value) => {
    onChange({ [field]: value });
  };

  const opts = (key) => config?.[key] || [];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Basisdaten</h2>
        <p style={styles.subtitle}>
          Erfassen Sie die grundlegenden Informationen zum Projektauftrag.
        </p>
      </div>

      {/* Projekt ID und Projektname */}
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Projekt ID</label>
          <input
            type="text"
            value={data.project_id || ''}
            onChange={(e) => handleChange('project_id', e.target.value)}
            placeholder="z.B. PRJ-2026-001"
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
      </div>

      {/* Projekttyp und Auftragsstatus */}
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Projekttyp</label>
          <select
            value={data.project_type || ''}
            onChange={(e) => handleChange('project_type', e.target.value)}
            style={styles.select}
          >
            <option value="">— Bitte auswählen —</option>
            {opts('project_type').map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Projektauftragsstatus</label>
          <select
            value={data.status || ''}
            onChange={(e) => handleChange('status', e.target.value)}
            style={styles.select}
          >
            <option value="">— Bitte auswählen —</option>
            {opts('order_status').map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Projektstatus und Projekttreiber */}
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Projektstatus</label>
          <select
            value={data.project_status || ''}
            onChange={(e) => handleChange('project_status', e.target.value)}
            style={styles.select}
          >
            <option value="">— Bitte auswählen —</option>
            {opts('project_status').map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Projekttreiber</label>
          <select
            value={data.project_driver || ''}
            onChange={(e) => handleChange('project_driver', e.target.value)}
            style={styles.select}
          >
            <option value="">— Bitte auswählen —</option>
            {opts('project_driver').map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Projektgröße und Priorität */}
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Projektgröße</label>
          <select
            value={data.project_size || ''}
            onChange={(e) => handleChange('project_size', e.target.value)}
            style={styles.select}
          >
            <option value="">— Bitte auswählen —</option>
            {opts('project_size').map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Priorität</label>
          <select
            value={data.priority || ''}
            onChange={(e) => handleChange('priority', e.target.value)}
            style={styles.select}
          >
            <option value="">— Bitte auswählen —</option>
            {opts('priority').map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
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

export default Basis;
