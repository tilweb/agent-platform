/**
 * TablesPage
 *
 * Main page for managing tables - shows grid of all tables with actions.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../config/theme';
import { useTables } from '../hooks/useTables';
import { TableIcon, ListIcon, TrashIcon } from '../components/Icons';
import PageHeader from '../components/overview/PageHeader';
import SearchInput from '../components/overview/SearchInput';
import ResourceCard, { CardGrid } from '../components/overview/ResourceCard';
import EmptyState from '../components/overview/EmptyState';
import HelpPanel from '../components/overview/HelpPanel';
import { filterBySearch, sortByName } from '../components/overview/grouping';

const styles = {
  container: {
    padding: theme.spacing['2xl'],
    width: '100%',
  },
  header: {
    marginBottom: theme.spacing['2xl'],
  },
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.md,
    flexWrap: 'wrap',
  },
  toolbarLeft: {
    display: 'flex',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  toolbarRight: {
    display: 'flex',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  button: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    borderRadius: theme.borderRadius.md,
    border: 'none',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    transition: `all ${theme.transitions.fast}`,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    color: 'white',
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: theme.spacing.lg,
  },
  card: {
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    position: 'relative',
  },
  cardHover: {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows.md,
  },
  cardIcon: {
    marginBottom: theme.spacing.md,
    color: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  cardDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
    minHeight: '40px',
  },
  cardMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  cardBadge: {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primaryDark,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  cardActions: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    display: 'flex',
    gap: theme.spacing.xs,
    opacity: 0,
    transition: `opacity ${theme.transitions.fast}`,
  },
  cardActionsVisible: {
    opacity: 1,
  },
  iconButton: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.sm,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textSecondary,
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['2xl'],
    maxWidth: '600px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'auto',
  },
  modalTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    marginBottom: theme.spacing.xl,
  },
  formGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    display: 'block',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    marginBottom: theme.spacing.sm,
    color: theme.colors.text,
  },
  input: {
    width: '100%',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
  },
  textarea: {
    width: '100%',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    minHeight: '100px',
    resize: 'vertical',
  },
  modalButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  templateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  templateCard: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  templateCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
};

function TablesPage() {
  const navigate = useNavigate();
  const {
    tables,
    loading,
    error,
    refresh,
    createTable,
    deleteTable,
    getTemplates,
    applyTemplate,
  } = useTables();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [search, setSearch] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    getTemplates().then(setTemplates).catch(console.error);
  }, [getTemplates]);

  const handleOpenTable = (tableId) => {
    navigate(`/tables/${tableId}`);
  };

  const handleDeleteTable = async (e, tableId) => {
    e.stopPropagation();
    if (confirm('Tabelle wirklich loschen? Diese Aktion kann nicht ruckgangig gemacht werden.')) {
      try {
        await deleteTable(tableId);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>Lade Tabellen...</div>
      </div>
    );
  }

  const visibleTables = sortByName(filterBySearch(tables, search));

  return (
    <div style={styles.container}>
      <PageHeader
        title="Tabellen"
        subtitle="Strukturierte Daten in flexiblen Tabellen — als Wissensquelle und für Auswertungen."
        onToggleHelp={() => setHelpOpen((v) => !v)}
        helpOpen={helpOpen}
        actions={(
          <>
            <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={refresh}>Aktualisieren</button>
            {templates.length > 0 && (
              <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={() => setShowTemplateModal(true)}>Vorlage verwenden</button>
            )}
            <button style={{ ...styles.button, ...styles.primaryButton }} onClick={() => setShowCreateModal(true)}>+ Neue Tabelle</button>
          </>
        )}
      />

      <HelpPanel
        open={helpOpen}
        title="Was sind Tabellen?"
        paragraphs={[
          'Tabellen speichern strukturierte Daten in Spalten und Zeilen — etwa Listen, Kataloge oder Stammdaten. Agenten können daraus lesen, und du kannst sie als Wissensquelle oder für Auswertungen nutzen. Mit einer Vorlage startest du schneller.',
        ]}
      />

      {/* Error */}
      {error && (
        <div style={{ color: theme.colors.error, marginBottom: theme.spacing.lg }}>
          Fehler: {error}
        </div>
      )}

      <div style={{ marginBottom: theme.spacing.lg }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Tabellen suchen…" />
      </div>

      {/* Table Grid */}
      {visibleTables.length === 0 ? (
        <EmptyState
          boxed
          icon={<TableIcon size={44} color={theme.colors.textMuted} />}
          title={search ? 'Keine Tabellen gefunden' : 'Keine Tabellen vorhanden'}
          subtitle={search ? 'Passe deine Suche an.' : 'Erstelle eine neue Tabelle oder verwende eine Vorlage, um zu beginnen.'}
          action={!search && (
            <button style={{ ...styles.button, ...styles.primaryButton }} onClick={() => setShowCreateModal(true)}>+ Neue Tabelle</button>
          )}
        />
      ) : (
        <CardGrid>
          {visibleTables.map(table => {
            const cols = table.columns?.length || 0;
            const rows = table.row_count || 0;
            return (
              <ResourceCard
                key={table.id}
                icon={table.icon
                  ? <span style={{ fontSize: 20, lineHeight: 1 }}>{table.icon}</span>
                  : <TableIcon size={22} color={theme.colors.primary} />}
                iconBg={theme.colors.primaryLight}
                title={table.name}
                meta={`${cols} ${cols === 1 ? 'Spalte' : 'Spalten'} · ${rows} ${rows === 1 ? 'Zeile' : 'Zeilen'}`}
                description={table.description || ''}
                footerAction={(
                  <button
                    style={styles.iconButton}
                    onClick={(e) => handleDeleteTable(e, table.id)}
                    onMouseOver={(e) => e.currentTarget.style.color = theme.colors.error}
                    onMouseOut={(e) => e.currentTarget.style.color = theme.colors.textMuted}
                    title="Löschen"
                  >
                    <TrashIcon size={16} />
                  </button>
                )}
                onClick={() => handleOpenTable(table.id)}
              />
            );
          })}
        </CardGrid>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTableModal
          onClose={() => setShowCreateModal(false)}
          onCreate={async (data) => {
            await createTable(data);
            setShowCreateModal(false);
          }}
        />
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <TemplateModal
          templates={templates}
          onClose={() => setShowTemplateModal(false)}
          onApply={async (templateId) => {
            await applyTemplate(templateId);
            setShowTemplateModal(false);
          }}
        />
      )}
    </div>
  );
}

function CreateTableModal({ onClose, onCreate }) {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    icon: '',
    columns: [
      { id: 'name', name: 'Name', type: 'text', required: true },
    ],
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSubmitting(true);
    try {
      // Auto-generate ID from name if not provided
      const id = formData.id.trim() || formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      await onCreate({ ...formData, id });
    } catch (err) {
      console.error('Error creating table:', err);
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.modalTitle}>Neue Tabelle erstellen</h2>

        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Name *</label>
            <input
              style={styles.input}
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="z.B. Kontakte, Projekte"
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Beschreibung</label>
            <textarea
              style={styles.textarea}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Wofur wird diese Tabelle verwendet?"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Icon (optional)</label>
            <input
              style={{ ...styles.input, width: '100px' }}
              type="text"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              placeholder=""
            />
          </div>

          <div style={styles.modalButtons}>
            <button
              type="button"
              style={{ ...styles.button, ...styles.secondaryButton }}
              onClick={onClose}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              style={{ ...styles.button, ...styles.primaryButton }}
              disabled={submitting || !formData.name.trim()}
            >
              {submitting ? 'Erstelle...' : 'Tabelle erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TemplateModal({ templates, onClose, onApply }) {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    if (!selectedTemplate) return;

    setApplying(true);
    try {
      await onApply(selectedTemplate);
    } catch (err) {
      console.error('Error applying template:', err);
      alert(err.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.modalTitle}>Vorlage verwenden</h2>

        <p style={{ marginBottom: theme.spacing.lg, color: theme.colors.textSecondary }}>
          Wahle eine Vorlage aus, um vordefinierte Tabellen zu erstellen.
        </p>

        <div style={styles.templateGrid}>
          {templates.map(template => (
            <div
              key={template.id}
              style={{
                ...styles.templateCard,
                ...(selectedTemplate === template.id ? styles.templateCardSelected : {}),
              }}
              onClick={() => setSelectedTemplate(template.id)}
            >
              <div style={{ marginBottom: theme.spacing.sm, color: theme.colors.primary, display: 'flex' }}>
                {template.icon ? template.icon : <ListIcon size={28} />}
              </div>
              <div style={{ fontWeight: theme.typography.weights.semibold }}>
                {template.name}
              </div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                {template.tables?.length || 0} Tabellen
              </div>
            </div>
          ))}
        </div>

        {selectedTemplate && (
          <div style={{
            padding: theme.spacing.lg,
            backgroundColor: theme.colors.surfaceHover,
            borderRadius: theme.borderRadius.md,
            marginBottom: theme.spacing.lg,
          }}>
            {templates.find(t => t.id === selectedTemplate)?.description}
          </div>
        )}

        <div style={styles.modalButtons}>
          <button
            type="button"
            style={{ ...styles.button, ...styles.secondaryButton }}
            onClick={onClose}
          >
            Abbrechen
          </button>
          <button
            style={{ ...styles.button, ...styles.primaryButton }}
            onClick={handleApply}
            disabled={!selectedTemplate || applying}
          >
            {applying ? 'Erstelle...' : 'Vorlage anwenden'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TablesPage;
