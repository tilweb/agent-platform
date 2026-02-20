import { useState, useEffect } from 'react';
import { theme } from '../config/theme';

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
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
  description: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  input: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    boxSizing: 'border-box',
    transition: `border-color ${theme.transitions.fast}`,
  },
  select: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    borderTop: `1px solid ${theme.colors.border}`,
  },
  button: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    border: 'none',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    color: '#fff',
  },
  deleteButton: {
    backgroundColor: 'transparent',
    color: theme.colors.error,
    border: `1px solid ${theme.colors.error}30`,
    marginRight: 'auto',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  error: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.error,
    padding: theme.spacing.md,
    backgroundColor: `${theme.colors.error}10`,
    borderRadius: theme.borderRadius.md,
  },
};

/**
 * Schema-driven form component for plugin configuration.
 * Renders fields based on configSchema from plugin manifests.
 */
export default function PluginConfigForm({
  configSchema = [],
  initialValues = {},
  onSave,
  onCancel,
  onDelete,
  saving = false,
  error = null,
  hasExistingConfig = false,
}) {
  const [values, setValues] = useState({});

  useEffect(() => {
    const initial = {};
    for (const field of configSchema) {
      initial[field.key] = initialValues[field.key] ?? field.default ?? '';
    }
    setValues(initial);
  }, [configSchema, initialValues]);

  const handleChange = (key, value) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave?.(values);
  };

  const renderField = (field) => {
    const value = values[field.key] ?? '';

    switch (field.type) {
      case 'boolean':
        return (
          <label style={styles.toggle}>
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleChange(field.key, e.target.checked)}
            />
            <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text }}>
              {field.label}
            </span>
          </label>
        );

      case 'enum':
        return (
          <select
            style={styles.select}
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
          >
            <option value="">Bitte wählen...</option>
            {(field.options || []).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case 'url':
        return (
          <input
            type="url"
            style={styles.input}
            value={value}
            placeholder={field.placeholder || 'https://...'}
            onChange={(e) => handleChange(field.key, e.target.value)}
            onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
            onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            style={styles.input}
            value={value}
            placeholder={field.placeholder || ''}
            onChange={(e) => handleChange(field.key, e.target.value)}
            onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
            onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
          />
        );

      default: // string
        return (
          <input
            type={field.secret ? 'password' : 'text'}
            style={styles.input}
            value={value}
            placeholder={field.placeholder || ''}
            onChange={(e) => handleChange(field.key, e.target.value)}
            autoComplete={field.secret ? 'new-password' : 'off'}
            onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
            onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
          />
        );
    }
  };

  return (
    <form style={styles.form} onSubmit={handleSubmit}>
      {error && <div style={styles.error}>{error}</div>}

      {configSchema.map((field) => (
        <div key={field.key} style={styles.fieldGroup}>
          {field.type !== 'boolean' && (
            <label style={styles.label}>
              {field.label}
              {field.required && <span style={styles.required}>*</span>}
            </label>
          )}
          {renderField(field)}
          {field.description && (
            <div style={styles.description}>{field.description}</div>
          )}
        </div>
      ))}

      <div style={styles.actions}>
        {hasExistingConfig && onDelete && (
          <button
            type="button"
            style={{ ...styles.button, ...styles.deleteButton }}
            onClick={onDelete}
            disabled={saving}
          >
            Entfernen
          </button>
        )}
        <button
          type="button"
          style={{ ...styles.button, ...styles.cancelButton }}
          onClick={onCancel}
          disabled={saving}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          style={{ ...styles.button, ...styles.saveButton, ...(saving ? styles.buttonDisabled : {}) }}
          disabled={saving}
        >
          {saving ? 'Speichern...' : 'Speichern'}
        </button>
      </div>
    </form>
  );
}
