import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { theme } from '../config/theme';
import WorkflowDesigner from './WorkflowDesigner';
import AllowedToolsSelector from './AllowedToolsSelector';
import KnowledgeEditor from './KnowledgeEditor';

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
    maxWidth: '900px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: theme.shadows.xl,
  },
  // Inline mode styles (for embedded editing)
  inlineContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
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
  tabs: {
    display: 'flex',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
    padding: `0 ${theme.spacing.xl}`,
    paddingTop: theme.spacing.lg,
    flexWrap: 'wrap',
  },
  tab: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  tabActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerActions: {
    display: 'flex',
    gap: theme.spacing.md,
  },
  button: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.text,
    border: 'none',
  },
  buttonPrimary: {
    backgroundColor: '#8b5cf6',
    color: '#fff',
    border: 'none',
  },
  buttonDanger: {
    backgroundColor: theme.colors.error,
    color: '#fff',
    border: 'none',
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
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
  },
  textarea: {
    width: '100%',
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    minHeight: '200px',
    fontFamily: theme.typography.fontMono,
    resize: 'vertical',
  },
  textareaSmall: {
    minHeight: '100px',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.lg,
  },
  row3: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr',
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
  infoBox: {
    padding: theme.spacing.lg,
    backgroundColor: '#8b5cf610',
    border: '1px solid #8b5cf630',
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
};

const TABS = [
  { id: 'basics', label: 'Basis' },
  { id: 'metadata', label: 'Metadata' },
  { id: 'allowed_tools', label: 'Tools' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'output', label: 'Output' },
];

const defaultSkill = {
  id: '',
  name: '',
  version: '1.0',
  description: '',
  metadata: {
    use_when: '',
    output_type: '',
  },
  allowed_tools: [],
  knowledge: {
    files: [],
    collections: [],
  },
  instructions: '',
  workflow: null,
  output: null,
  enabled: true,
};

const SkillEditor = forwardRef(function SkillEditor({ skill, onSave, onClose, onDelete, inline = false }, ref) {
  const [activeTab, setActiveTab] = useState('basics');
  const [formData, setFormData] = useState(defaultSkill);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const isNew = !skill?.id;

  // Expose save and delete methods for parent component
  useImperativeHandle(ref, () => ({
    save: handleSave,
    delete: handleDelete,
    getFormData: () => formData,
    isSaving: () => isSaving,
  }));

  useEffect(() => {
    if (skill) {
      setFormData({
        ...defaultSkill,
        ...skill,
        metadata: {
          ...defaultSkill.metadata,
          ...skill.metadata,
        },
        allowed_tools: skill.allowed_tools || [],
        knowledge: {
          ...defaultSkill.knowledge,
          ...skill.knowledge,
        },
      });
    }
  }, [skill]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleMetadataChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      metadata: { ...prev.metadata, [field]: value },
    }));
  };

  const handleAllowedToolsChange = (allowedTools) => {
    setFormData(prev => ({ ...prev, allowed_tools: allowedTools }));
  };

  const handleKnowledgeChange = (knowledge) => {
    setFormData(prev => ({ ...prev, knowledge }));
  };

  const handleWorkflowChange = (workflow) => {
    setFormData(prev => ({ ...prev, workflow }));
  };

  const handleOutputChange = (output) => {
    setFormData(prev => ({ ...prev, output }));
  };

  const handleSave = async () => {
    if (!formData.id?.trim()) {
      setError('ID ist erforderlich');
      setActiveTab('basics');
      return;
    }
    if (!formData.name?.trim()) {
      setError('Name ist erforderlich');
      setActiveTab('basics');
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

  const handleDelete = async () => {
    if (!confirm(`Skill "${formData.name}" wirklich löschen?`)) return;

    try {
      await onDelete(formData.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const renderBasicsTab = () => (
    <>
      <div style={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>
            ID
            <span style={styles.labelHint}>(eindeutig, keine Leerzeichen)</span>
          </label>
          <input
            type="text"
            style={styles.input}
            value={formData.id}
            onChange={(e) => handleChange('id', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
            placeholder="z.B. code-review"
            disabled={!isNew}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Version</label>
          <input
            type="text"
            style={styles.input}
            value={formData.version}
            onChange={(e) => handleChange('version', e.target.value)}
            placeholder="1.0"
          />
        </div>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Name</label>
        <input
          type="text"
          style={styles.input}
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="z.B. Code Review Assistent"
        />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Beschreibung</label>
        <input
          type="text"
          style={styles.input}
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Kurze Beschreibung des Skills"
        />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Instructions</label>
        <textarea
          style={styles.textarea}
          value={formData.instructions}
          onChange={(e) => handleChange('instructions', e.target.value)}
          placeholder="Anweisungen für den Agenten, wenn dieser Skill aktiv ist..."
        />
      </div>

      <div style={styles.field}>
        <label style={styles.checkbox}>
          <input
            type="checkbox"
            style={styles.checkboxInput}
            checked={formData.enabled}
            onChange={(e) => handleChange('enabled', e.target.checked)}
          />
          <span>Skill aktiviert</span>
        </label>
      </div>
    </>
  );

  const renderMetadataTab = () => (
    <>
      <div style={styles.infoBox}>
        <strong>Agent-Entscheidungshilfe:</strong> Diese Metadaten werden im System-Prompt des Agents angezeigt,
        damit er entscheiden kann, wann dieser Skill geladen werden soll.
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Wann verwenden?</label>
        <textarea
          style={{ ...styles.textarea, ...styles.textareaSmall }}
          value={formData.metadata?.use_when || ''}
          onChange={(e) => handleMetadataChange('use_when', e.target.value)}
          placeholder={`- User fragt nach ausführlicher Recherche
- Komplexes Thema mit mehreren Aspekten
- Quellenbasierte Analyse erforderlich`}
        />
      </div>

      <div style={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>Output-Typ</label>
          <input
            type="text"
            style={styles.input}
            value={formData.metadata?.output_type || ''}
            onChange={(e) => handleMetadataChange('output_type', e.target.value)}
            placeholder="z.B. Strukturierter Report"
          />
        </div>
      </div>
    </>
  );

  const renderAllowedToolsTab = () => (
    <>
      <div style={styles.infoBox}>
        <strong>Tool-Erweiterung:</strong> Diese Tools werden dem Agent <em>hinzugefügt</em>, wenn er diesen Skill lädt.
        Der Agent erhält diese Tools temporär zusätzlich zu seinen Basis-Tools.
      </div>
      <AllowedToolsSelector
        allowedTools={formData.allowed_tools || []}
        onChange={handleAllowedToolsChange}
      />
    </>
  );

  const renderKnowledgeTab = () => (
    <KnowledgeEditor
      knowledge={formData.knowledge || { files: [], collections: [] }}
      onChange={handleKnowledgeChange}
    />
  );

  const renderOutputTab = () => (
    <>
      <div style={styles.field}>
        <label style={styles.label}>Output Format</label>
        <select
          style={styles.input}
          value={formData.output?.format || 'markdown'}
          onChange={(e) => handleOutputChange({
            ...formData.output,
            format: e.target.value,
          })}
        >
          <option value="markdown">Markdown</option>
          <option value="json">JSON</option>
          <option value="text">Text</option>
        </select>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>
          Output Template
          <span style={styles.labelHint}>(optional - Mustache-Syntax)</span>
        </label>
        <textarea
          style={{ ...styles.textarea, minHeight: '300px' }}
          value={formData.output?.template || ''}
          onChange={(e) => handleOutputChange({
            ...formData.output,
            template: e.target.value,
          })}
          placeholder={`## {{title}}

### Zusammenfassung
{{summary}}

### Details
{{#items}}
- {{name}}: {{description}}
{{/items}}`}
        />
      </div>
    </>
  );

  // Inline mode: only tabs + body, no header/footer (parent handles actions)
  if (inline) {
    return (
      <div style={styles.inlineContainer}>
        <div style={styles.tabs}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                style={{
                  ...styles.tab,
                  ...(isActive ? styles.tabActive : {}),
                }}
                onClick={() => setActiveTab(tab.id)}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div style={styles.body}>
          {error && <div style={styles.error}>{error}</div>}

          {activeTab === 'basics' && renderBasicsTab()}
          {activeTab === 'metadata' && renderMetadataTab()}
          {activeTab === 'allowed_tools' && renderAllowedToolsTab()}
          {activeTab === 'knowledge' && renderKnowledgeTab()}
          {activeTab === 'workflow' && (
            <WorkflowDesigner
              workflow={formData.workflow}
              onChange={handleWorkflowChange}
              availableTools={formData.allowed_tools || []}
            />
          )}
          {activeTab === 'output' && renderOutputTab()}
        </div>
      </div>
    );
  }

  // Modal mode: full editor with header and footer
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            {isNew ? 'Neuer Skill' : `Skill bearbeiten: ${formData.name}`}
          </h2>
          <button style={styles.closeButton} onClick={onClose}>
            &times;
          </button>
        </div>

        <div style={styles.tabs}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                style={{
                  ...styles.tab,
                  ...(isActive ? styles.tabActive : {}),
                }}
                onClick={() => setActiveTab(tab.id)}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div style={styles.body}>
          {error && <div style={styles.error}>{error}</div>}

          {activeTab === 'basics' && renderBasicsTab()}
          {activeTab === 'metadata' && renderMetadataTab()}
          {activeTab === 'allowed_tools' && renderAllowedToolsTab()}
          {activeTab === 'knowledge' && renderKnowledgeTab()}
          {activeTab === 'workflow' && (
            <WorkflowDesigner
              workflow={formData.workflow}
              onChange={handleWorkflowChange}
              availableTools={formData.allowed_tools || []}
            />
          )}
          {activeTab === 'output' && renderOutputTab()}
        </div>

        <div style={styles.footer}>
          <div>
            {!isNew && onDelete && (
              <button
                style={{ ...styles.button, ...styles.buttonDanger }}
                onClick={handleDelete}
              >
                Löschen
              </button>
            )}
          </div>
          <div style={styles.footerActions}>
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
    </div>
  );
});

export default SkillEditor;
