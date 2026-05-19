/**
 * SchemaEditor
 * Component for managing contract type schemas in settings
 */

import { useState } from 'react';
import { theme } from '../../config/theme';
import { useContracts } from '../../hooks/useContracts';
import { TrashIcon, PenIcon, SparklesIcon, BrainIcon } from '../../components/Icons';
import { apiPost } from '../../utils/apiFetch';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  addButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: 'white',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  schemaList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  schemaCard: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  schemaInfo: {
    flex: 1,
  },
  schemaName: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  schemaId: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  schemaFields: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
  },
  schemaActions: {
    display: 'flex',
    gap: theme.spacing.sm,
  },
  iconButton: {
    padding: theme.spacing.sm,
    backgroundColor: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    color: theme.colors.textMuted,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    color: theme.colors.error,
    borderColor: `${theme.colors.error}30`,
  },
  empty: {
    padding: theme.spacing.xl,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  // Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
  },
  modal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    width: '90%',
    maxWidth: '700px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: theme.spacing.xl,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  modalTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    margin: 0,
  },
  modalContent: {
    flex: 1,
    padding: theme.spacing.xl,
    overflowY: 'auto',
  },
  modalFooter: {
    padding: theme.spacing.xl,
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
  },
  formGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    display: 'block',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
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
  },
  textarea: {
    width: '100%',
    minHeight: '300px',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontMono,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    resize: 'vertical',
    outline: 'none',
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  cancelButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  saveButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.primary,
    color: 'white',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  error: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.lg,
    whiteSpace: 'pre-wrap',
    fontFamily: theme.typography.fontFamily,
    lineHeight: 1.5,
  },
  aiHelper: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.lg,
    border: `1px solid ${theme.colors.primary}30`,
  },
  aiHelperHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.medium,
    fontSize: theme.typography.sizes.sm,
  },
  aiHelperRow: {
    display: 'flex',
    gap: theme.spacing.md,
  },
  aiInput: {
    flex: 1,
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
  },
  aiButton: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: 'white',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    whiteSpace: 'nowrap',
  },
};

// Default schema template
const defaultSchemaYaml = `id: neuer-typ
name: Neuer Vertragstyp
icon: document

fields:
  vertragspartner:
    partei_a:
      type: text
      required: true
      label: Partei A
    partei_b:
      type: text
      required: true
      label: Partei B

  laufzeit:
    beginn:
      type: date
      required: true
      label: Vertragsbeginn
    ende:
      type: date
      label: Vertragsende
    kuendigungsfrist_monate:
      type: number
      label: Kündigungsfrist (Monate)

  finanzen:
    wert:
      type: number
      label: Vertragswert

mapping:
  party_a: vertragspartner.partei_a
  party_b: vertragspartner.partei_b
  start_date: laufzeit.beginn
  end_date: laufzeit.ende
  value: finanzen.wert`;

function countFields(schema) {
  if (!schema.fields) return 0;
  let count = 0;
  for (const category of Object.values(schema.fields)) {
    if (typeof category === 'object') {
      count += Object.keys(category).length;
    }
  }
  return count;
}

export default function SchemaEditor() {
  const { schemas, createSchema, updateSchema, deleteSchema, refreshSchemas } = useContracts();
  const [showModal, setShowModal] = useState(false);
  const [editingSchema, setEditingSchema] = useState(null);
  const [schemaYaml, setSchemaYaml] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [contractTypeInput, setContractTypeInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateSuggestion = async () => {
    if (!contractTypeInput.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await apiPost('/apps/vertragsmanagement/schemas/suggest', {
        contractType: contractTypeInput.trim(),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler bei der Schema-Generierung');
      }

      const data = await response.json();
      setSchemaYaml(data.suggestion);
      setContractTypeInput('');
    } catch (err) {
      console.error('Generate error:', err);
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAdd = () => {
    setEditingSchema(null);
    setSchemaYaml(defaultSchemaYaml);
    setContractTypeInput('');
    setError(null);
    setShowModal(true);
  };

  const handleEdit = async (schema) => {
    // Convert schema object to YAML
    const { stringify } = await import('yaml');
    setEditingSchema(schema);
    setSchemaYaml(stringify(schema));
    setError(null);
    setShowModal(true);
  };

  const handleDelete = async (schema) => {
    if (!confirm(`Schema "${schema.name}" wirklich löschen?`)) return;

    try {
      await deleteSchema(schema.id);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Parse YAML
      const { parse } = await import('yaml');
      const schemaData = parse(schemaYaml);

      if (!schemaData.id || !schemaData.name) {
        throw new Error('Schema muss "id" und "name" enthalten');
      }

      if (editingSchema) {
        // Update existing
        await updateSchema(editingSchema.id, schemaData);
      } else {
        // Create new
        await createSchema(schemaData);
      }

      setShowModal(false);
      refreshSchemas();
    } catch (err) {
      console.error('Save error:', err);
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Vertragstypen</span>
        <button
          style={styles.addButton}
          onClick={handleAdd}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.primary;
          }}
        >
          <SparklesIcon size={16} />
          Neuer Typ
        </button>
      </div>

      <div style={styles.schemaList}>
        {schemas.length === 0 ? (
          <div style={styles.empty}>
            Keine Vertragstypen vorhanden. Erstellen Sie einen neuen Typ.
          </div>
        ) : (
          schemas.map((schema) => (
            <div key={schema.id} style={styles.schemaCard}>
              <div style={styles.schemaInfo}>
                <div style={styles.schemaName}>{schema.name}</div>
                <div style={styles.schemaId}>ID: {schema.id}</div>
                <div style={styles.schemaFields}>
                  {countFields(schema)} Felder definiert
                </div>
              </div>
              <div style={styles.schemaActions}>
                <button
                  style={styles.iconButton}
                  onClick={() => handleEdit(schema)}
                  title="Bearbeiten"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <PenIcon size={16} />
                </button>
                <button
                  style={{ ...styles.iconButton, ...styles.deleteButton }}
                  onClick={() => handleDelete(schema)}
                  title="Löschen"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.errorLight;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit/Create Modal */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingSchema ? 'Vertragstyp bearbeiten' : 'Neuer Vertragstyp'}
              </h2>
            </div>

            <div style={styles.modalContent}>
              {error && <div style={styles.error}>{error}</div>}

              {/* AI Helper - only for new schemas */}
              {!editingSchema && (
                <div style={styles.aiHelper}>
                  <div style={styles.aiHelperHeader}>
                    <BrainIcon size={16} />
                    KI-Assistent
                  </div>
                  <div style={styles.aiHelperRow}>
                    <input
                      type="text"
                      style={styles.aiInput}
                      placeholder="z.B. Reinigungsvertrag, Wartungsvertrag, Lizenzvertrag..."
                      value={contractTypeInput}
                      onChange={(e) => setContractTypeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isGenerating) {
                          handleGenerateSuggestion();
                        }
                      }}
                      disabled={isGenerating}
                    />
                    <button
                      style={{
                        ...styles.aiButton,
                        opacity: isGenerating || !contractTypeInput.trim() ? 0.5 : 1,
                      }}
                      onClick={handleGenerateSuggestion}
                      disabled={isGenerating || !contractTypeInput.trim()}
                      onMouseEnter={(e) => {
                        if (!isGenerating && contractTypeInput.trim()) {
                          e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = theme.colors.primary;
                      }}
                    >
                      <SparklesIcon size={14} />
                      {isGenerating ? 'Generiere...' : 'Vorschlag'}
                    </button>
                  </div>
                </div>
              )}

              <div style={styles.formGroup}>
                <label style={styles.label}>Schema (YAML)</label>
                <textarea
                  style={styles.textarea}
                  value={schemaYaml}
                  onChange={(e) => setSchemaYaml(e.target.value)}
                  spellCheck={false}
                />
                <p style={styles.hint}>
                  Definieren Sie die Felder und das Mapping im YAML-Format.
                  Feldtypen: text, number, date.
                  Das Mapping definiert die Standard-Felder für die Übersicht.
                </p>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                style={styles.cancelButton}
                onClick={() => setShowModal(false)}
                disabled={isSaving}
              >
                Abbrechen
              </button>
              <button
                style={{
                  ...styles.saveButton,
                  opacity: isSaving ? 0.5 : 1,
                }}
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
