import { useState, useEffect } from 'react';
import { theme } from '../config/theme';
import Select from './Select';

// Toggle icons (per design system pattern from frontend/CLAUDE.md)
function ToggleOnIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.colors.success} strokeWidth="2">
      <rect x="1" y="5" width="22" height="14" rx="7" ry="7" />
      <circle cx="16" cy="12" r="3" fill={theme.colors.success} />
    </svg>
  );
}

function ToggleOffIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="1" y="5" width="22" height="14" rx="7" ry="7" />
      <circle cx="8" cy="12" r="3" />
    </svg>
  );
}

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
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  toggleButton: {
    display: 'flex',
    alignItems: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
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
  validationError: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
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

  const [validationErrors, setValidationErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate required fields
    const errors = {};
    for (const field of configSchema) {
      if (field.required) {
        const val = values[field.key];
        if (val === undefined || val === null || val === '') {
          errors[field.key] = `${field.label} ist erforderlich`;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    onSave?.(values);
  };

  const renderField = (field) => {
    const value = values[field.key] ?? '';

    switch (field.type) {
      case 'boolean':
        return (
          <div style={styles.toggle}>
            <button
              type="button"
              style={styles.toggleButton}
              onClick={() => handleChange(field.key, !value)}
              title={value ? 'Deaktivieren' : 'Aktivieren'}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {value ? <ToggleOnIcon /> : <ToggleOffIcon />}
            </button>
            <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text }}>
              {field.label}
            </span>
          </div>
        );

      case 'enum':
        return (
          <Select
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder="Bitte wählen..."
            options={(field.options || []).map(opt => ({ value: opt, label: opt }))}
          />
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
          {validationErrors[field.key] && (
            <div style={styles.validationError}>
              {validationErrors[field.key]}
            </div>
          )}
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
