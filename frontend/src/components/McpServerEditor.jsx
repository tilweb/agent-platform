import { useState, useEffect } from 'react';
import { theme } from '../config/theme';

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: theme.spacing.xl,
  },
  modal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    width: '100%',
    maxWidth: '600px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: theme.shadows.xl,
  },
  header: {
    padding: theme.spacing.xl,
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: '20px',
  },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: theme.spacing.xl,
  },
  footer: {
    padding: theme.spacing.xl,
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
  },
  field: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    display: 'block',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  labelHint: {
    fontWeight: theme.typography.weights.normal,
    color: theme.colors.textMuted,
    marginLeft: theme.spacing.sm,
  },
  input: {
    width: '100%',
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.lg,
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    cursor: 'pointer',
  },
  checkboxInput: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  button: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.text,
    border: 'none',
  },
  buttonPrimary: {
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
  },
  error: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
    fontSize: theme.typography.sizes.sm,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  envVarList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  envVarRow: {
    display: 'flex',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  envVarInput: {
    flex: 1,
    padding: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    fontFamily: theme.typography.fontMono,
  },
  envVarRemove: {
    padding: theme.spacing.sm,
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: theme.colors.textMuted,
  },
  addEnvButton: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceHover,
    border: 'none',
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
  },
  presetSelect: {
    marginBottom: theme.spacing.lg,
  },
  select: {
    width: '100%',
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    cursor: 'pointer',
  },
};

function McpServerEditor({ server, presets, onSave, onClose }) {
  const isNew = !server?.id || !server?.name;

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    command: 'npx',
    args: [],
    env: {},
    enabled: true,
    autoConnect: true,
  });
  const [argsString, setArgsString] = useState('');
  const [envVars, setEnvVars] = useState([]);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (server) {
      setFormData({
        id: server.id || '',
        name: server.name || '',
        command: server.command || 'npx',
        args: server.args || [],
        env: server.env || {},
        enabled: server.enabled !== false,
        autoConnect: server.autoConnect !== false,
      });
      setArgsString((server.args || []).join(' '));
      setEnvVars(
        Object.entries(server.env || {}).map(([key, value]) => ({ key, value }))
      );
    }
  }, [server]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleArgsChange = (value) => {
    setArgsString(value);
    // Parse args (simple split, respecting quotes would be better)
    const args = value.split(' ').filter(Boolean);
    setFormData(prev => ({ ...prev, args }));
  };

  const handleEnvChange = (index, field, value) => {
    const newEnvVars = [...envVars];
    newEnvVars[index] = { ...newEnvVars[index], [field]: value };
    setEnvVars(newEnvVars);

    // Update formData.env
    const env = {};
    newEnvVars.forEach(({ key, value }) => {
      if (key) env[key] = value;
    });
    setFormData(prev => ({ ...prev, env }));
  };

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const removeEnvVar = (index) => {
    const newEnvVars = envVars.filter((_, i) => i !== index);
    setEnvVars(newEnvVars);

    const env = {};
    newEnvVars.forEach(({ key, value }) => {
      if (key) env[key] = value;
    });
    setFormData(prev => ({ ...prev, env }));
  };

  const handlePresetSelect = (presetId) => {
    if (!presetId) return;
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    setFormData({
      id: preset.id,
      name: preset.name,
      command: preset.command,
      args: preset.args || [],
      env: preset.env || {},
      enabled: true,
      autoConnect: true,
    });
    setArgsString((preset.args || []).join(' '));
    setEnvVars(
      Object.entries(preset.env || {}).map(([key, value]) => ({ key, value }))
    );
  };

  const handleSave = async () => {
    if (!formData.id?.trim()) {
      setError('ID ist erforderlich');
      return;
    }
    if (!formData.name?.trim()) {
      setError('Name ist erforderlich');
      return;
    }
    if (!formData.command?.trim()) {
      setError('Command ist erforderlich');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(formData);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            {isNew ? 'MCP Server hinzufügen' : `Server bearbeiten: ${formData.name}`}
          </h2>
          <button style={styles.closeButton} onClick={onClose}>
            &times;
          </button>
        </div>

        <div style={styles.body}>
          {error && <div style={styles.error}>{error}</div>}

          {/* Preset Selection */}
          {isNew && presets.length > 0 && (
            <div style={styles.presetSelect}>
              <label style={styles.label}>Preset wählen (optional)</label>
              <select
                style={styles.select}
                onChange={(e) => handlePresetSelect(e.target.value)}
                defaultValue=""
              >
                <option value="">-- Manuell konfigurieren --</option>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Basic Info */}
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>
                ID
                <span style={styles.labelHint}>(eindeutig)</span>
              </label>
              <input
                type="text"
                style={styles.input}
                value={formData.id}
                onChange={(e) => handleChange('id', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="z.B. github"
                disabled={!isNew}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Name</label>
              <input
                type="text"
                style={styles.input}
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="z.B. GitHub MCP Server"
              />
            </div>
          </div>

          {/* Command */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Ausführung</div>

            <div style={styles.field}>
              <label style={styles.label}>Command</label>
              <input
                type="text"
                style={{ ...styles.input, fontFamily: theme.typography.fontMono }}
                value={formData.command}
                onChange={(e) => handleChange('command', e.target.value)}
                placeholder="npx"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                Arguments
                <span style={styles.labelHint}>(durch Leerzeichen getrennt)</span>
              </label>
              <input
                type="text"
                style={{ ...styles.input, fontFamily: theme.typography.fontMono }}
                value={argsString}
                onChange={(e) => handleArgsChange(e.target.value)}
                placeholder="-y @modelcontextprotocol/server-github"
              />
            </div>
          </div>

          {/* Environment Variables */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Umgebungsvariablen</div>

            <div style={styles.envVarList}>
              {envVars.map((envVar, index) => (
                <div key={index} style={styles.envVarRow}>
                  <input
                    type="text"
                    style={styles.envVarInput}
                    value={envVar.key}
                    onChange={(e) => handleEnvChange(index, 'key', e.target.value)}
                    placeholder="KEY"
                  />
                  <span style={{ color: theme.colors.textMuted }}>=</span>
                  <input
                    type="text"
                    style={styles.envVarInput}
                    value={envVar.value}
                    onChange={(e) => handleEnvChange(index, 'value', e.target.value)}
                    placeholder="value oder ${ENV_VAR}"
                  />
                  <button
                    style={styles.envVarRemove}
                    onClick={() => removeEnvVar(index)}
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button style={styles.addEnvButton} onClick={addEnvVar}>
                + Variable hinzufügen
              </button>
            </div>
          </div>

          {/* Options */}
          <div style={styles.field}>
            <label style={styles.checkbox}>
              <input
                type="checkbox"
                style={styles.checkboxInput}
                checked={formData.enabled}
                onChange={(e) => handleChange('enabled', e.target.checked)}
              />
              <span>Server aktiviert</span>
            </label>
          </div>

          <div style={styles.field}>
            <label style={styles.checkbox}>
              <input
                type="checkbox"
                style={styles.checkboxInput}
                checked={formData.autoConnect}
                onChange={(e) => handleChange('autoConnect', e.target.checked)}
              />
              <span>Automatisch beim Start verbinden</span>
            </label>
          </div>
        </div>

        <div style={styles.footer}>
          <button
            style={{ ...styles.button, ...styles.buttonSecondary }}
            onClick={onClose}
          >
            Abbrechen
          </button>
          <button
            style={{ ...styles.button, ...styles.buttonPrimary }}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default McpServerEditor;
