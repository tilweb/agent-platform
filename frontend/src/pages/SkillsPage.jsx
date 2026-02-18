import { useState, useEffect, useRef } from 'react';
import { theme } from '../config/theme';
import SkillEditor from '../components/SkillEditor';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const styles = {
  container: {
    width: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xl,
  },
  headerContent: {},
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textMuted,
  },
  headerActions: {
    display: 'flex',
    gap: theme.spacing.md,
  },
  reloadButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  createButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: '#8b5cf6',
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  searchContainer: {
    marginBottom: theme.spacing.xl,
  },
  searchInput: {
    width: '100%',
    maxWidth: '400px',
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    fontSize: theme.typography.sizes.base,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
    transition: `all ${theme.transitions.fast}`,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  cardIcon: {
    width: '48px',
    height: '48px',
    borderRadius: theme.borderRadius.lg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardIconDefault: {
    backgroundColor: '#8b5cf620',
  },
  cardIconWorkflow: {
    backgroundColor: '#3b82f620',
  },
  cardTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: '2px',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  cardId: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontMono,
    backgroundColor: theme.colors.surfaceHover,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
  },
  cardVersion: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  cardDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.relaxed,
    marginBottom: theme.spacing.md,
  },
  section: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing.sm,
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  tag: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
  },
  keywordTag: {
    backgroundColor: '#8b5cf615',
    color: '#8b5cf6',
  },
  patternTag: {
    backgroundColor: '#f59e0b15',
    color: '#f59e0b',
    fontFamily: theme.typography.fontMono,
    fontSize: '10px',
  },
  toolTag: {
    backgroundColor: '#10b98115',
    color: '#10b981',
  },
  toolTagOptional: {
    backgroundColor: '#6b728015',
    color: '#6b7280',
  },
  badges: {
    display: 'flex',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  badge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    fontWeight: theme.typography.weights.medium,
  },
  badgeWorkflow: {
    backgroundColor: '#3b82f620',
    color: '#3b82f6',
  },
  badgeOutput: {
    backgroundColor: '#8b5cf620',
    color: '#8b5cf6',
  },
  badgeDisabled: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
  },
  badgeSystem: {
    backgroundColor: '#6366f120',
    color: '#6366f1',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.border}`,
    marginTop: theme.spacing.md,
  },
  footerInfo: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  cardActions: {
    display: 'flex',
    gap: theme.spacing.sm,
  },
  actionButton: {
    padding: theme.spacing.sm,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    color: theme.colors.textMuted,
    transition: `all ${theme.transitions.fast}`,
  },
  loading: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  error: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.borderRadius.lg,
    color: theme.colors.error,
    marginBottom: theme.spacing.lg,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  success: {
    padding: theme.spacing.lg,
    backgroundColor: '#10b98110',
    borderRadius: theme.borderRadius.lg,
    border: '1px solid #10b98130',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: theme.typography.sizes.sm,
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
  },
  sectionHeader: {
    marginBottom: theme.spacing.lg,
    marginTop: theme.spacing.xl,
  },
  sectionHeaderFirst: {
    marginTop: 0,
  },
  sectionHeaderTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  sectionHeaderSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  hint: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  code: {
    fontFamily: theme.typography.fontMono,
    backgroundColor: theme.colors.surface,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.typography.sizes.xs,
  },
  // Detail Page
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary,
    cursor: 'pointer',
    marginBottom: theme.spacing.lg,
    border: 'none',
    background: 'none',
    padding: 0,
    fontWeight: theme.typography.weights.medium,
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xl,
  },
  detailHeaderLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.lg,
  },
  detailIcon: {
    width: '64px',
    height: '64px',
    borderRadius: theme.borderRadius.xl,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  detailTitle: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  detailSubtitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  detailActions: {
    display: 'flex',
    gap: theme.spacing.md,
  },
  headerButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerButtonDanger: {
    color: theme.colors.error,
    borderColor: `${theme.colors.error}30`,
  },
  headerButtonPrimary: {
    backgroundColor: '#8b5cf6',
    color: '#fff',
    border: 'none',
  },
  detailContent: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.xl,
  },
  detailCard: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
  },
  detailCardFull: {
    gridColumn: '1 / -1',
  },
  detailCardTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  codeBlock: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    fontFamily: theme.typography.fontMono,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    whiteSpace: 'pre-wrap',
    overflow: 'auto',
    maxHeight: '300px',
  },
  workflowStep: {
    display: 'flex',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  stepNumber: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    flexShrink: 0,
  },
  stepContent: {
    flex: 1,
  },
  stepAction: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  stepDescription: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: '2px',
  },
  buttonSecondary: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
};

// Extracted SkillCard component for reuse in both sections
function SkillCard({ skill, onView, onEdit }) {
  return (
    <div
      style={{ ...styles.card, cursor: 'pointer' }}
      onClick={() => onView(skill)}
      onMouseOver={(e) => {
        e.currentTarget.style.boxShadow = theme.shadows.lg;
        e.currentTarget.style.borderColor = skill.system ? '#6366f1' : (skill.hasWorkflow ? '#3b82f6' : '#8b5cf6');
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = theme.colors.border;
      }}
    >
      <div style={styles.cardHeader}>
        <div style={{
          ...styles.cardIcon,
          ...(skill.hasWorkflow ? styles.cardIconWorkflow : styles.cardIconDefault)
        }}>
          {skill.hasWorkflow ? (
            <WorkflowIcon color="#3b82f6" />
          ) : (
            <SkillIcon color="#8b5cf6" />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={styles.cardTitle}>{skill.name}</div>
          <div style={styles.cardMeta}>
            <span style={styles.cardId}>{skill.id}</span>
            <span style={styles.cardVersion}>v{skill.version}</span>
          </div>
        </div>
      </div>

      {skill.description && (
        <p style={styles.cardDescription}>{skill.description}</p>
      )}

      {/* Badges */}
      <div style={styles.badges}>
        {skill.system && (
          <span style={{ ...styles.badge, ...styles.badgeSystem }}>
            System
          </span>
        )}
        {skill.hasWorkflow && (
          <span style={{ ...styles.badge, ...styles.badgeWorkflow }}>
            Workflow
          </span>
        )}
        {skill.hasOutput && (
          <span style={{ ...styles.badge, ...styles.badgeOutput }}>
            Template
          </span>
        )}
        {!skill.enabled && (
          <span style={{ ...styles.badge, ...styles.badgeDisabled }}>
            Deaktiviert
          </span>
        )}
      </div>

      {onEdit && (
        <div style={styles.cardFooter}>
          <span></span>
          <div style={styles.cardActions}>
            <button
              style={styles.actionButton}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(skill);
              }}
              onMouseOver={(e) => e.currentTarget.style.color = '#10b981'}
              onMouseOut={(e) => e.currentTarget.style.color = theme.colors.textMuted}
              title="Bearbeiten"
            >
              <EditIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SkillsPage() {
  const [skills, setSkills] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailSkill, setDetailSkill] = useState(null);
  const [editorSkill, setEditorSkill] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef(null);

  const fetchSkills = async () => {
    try {
      const response = await fetch(`${API_URL}/skills`);
      if (!response.ok) throw new Error('Failed to fetch skills');
      const data = await response.json();
      setSkills(data.skills || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter skills by search query
  const filteredSkills = skills
    .filter(skill => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        skill.name?.toLowerCase().includes(query) ||
        skill.description?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'));

  // Separate system and custom skills
  const systemSkills = filteredSkills.filter(s => s.system);
  const customSkills = filteredSkills.filter(s => !s.system);

  const handleBackToOverview = () => {
    setDetailSkill(null);
    setError(null);
  };

  const reloadSkills = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/skills/reload`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to reload skills');
      await fetchSkills();
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const viewSkillDetails = async (skill) => {
    try {
      const response = await fetch(`${API_URL}/skills/${skill.id}`);
      if (!response.ok) throw new Error('Failed to load skill details');
      const data = await response.json();
      setDetailSkill(data);
      // For custom skills, also set as editor skill for inline editing
      if (!data.system) {
        setEditorSkill(data);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const openEditor = async (skill = null) => {
    if (skill) {
      // For existing skills, navigate to detail view which now includes inline editing
      await viewSkillDetails(skill);
    } else {
      // For new skills, open modal
      setEditorSkill(null);
      setShowEditor(true);
    }
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditorSkill(null);
  };

  const handleSaveSkill = async (skillData) => {
    const isNew = !editorSkill?.id;
    const url = isNew ? `${API_URL}/skills` : `${API_URL}/skills/${skillData.id}`;
    const method = isNew ? 'POST' : 'PUT';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(skillData),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save skill');
    }

    await fetchSkills();

    // For inline editing, stay on detail page but refresh data
    if (detailSkill && !isNew) {
      await viewSkillDetails({ id: skillData.id });
    } else {
      closeEditor();
    }
  };

  const handleDeleteSkill = async (skillId) => {
    const response = await fetch(`${API_URL}/skills/${skillId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete skill');
    }

    await fetchSkills();
    closeEditor();
  };

  // Handler for inline editor save (called from header button)
  const handleSaveFromHeader = async () => {
    if (editorRef.current) {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);
      try {
        await editorRef.current.save();
        setSuccessMessage('Skill erfolgreich gespeichert');
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Handler for inline editor delete (called from header button)
  const handleDeleteFromHeader = async () => {
    if (!confirm(`Skill "${detailSkill.name}" wirklich löschen?`)) return;
    try {
      await handleDeleteSkill(detailSkill.id);
      handleBackToOverview();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  if (isLoading) {
    return <div style={styles.loading}>Lade Skills...</div>;
  }

  // ==========================================
  // RENDER: Detail View
  // ==========================================

  if (detailSkill) {
    // For custom skills: show inline editor
    // For system skills: show read-only view
    const isCustomSkill = !detailSkill.system;

    return (
      <div style={styles.container}>
        {/* Back Link */}
        <button style={styles.backLink} onClick={handleBackToOverview}>
          <ArrowLeftIcon /> Skills
        </button>

        {/* Detail Header */}
        <div style={styles.detailHeader}>
          <div style={styles.detailHeaderLeft}>
            <div style={{
              ...styles.detailIcon,
              backgroundColor: detailSkill.hasWorkflow ? '#3b82f620' : '#8b5cf620'
            }}>
              {detailSkill.hasWorkflow ? (
                <WorkflowIcon color="#3b82f6" size={32} />
              ) : (
                <SkillIcon color="#8b5cf6" size={32} />
              )}
            </div>
            <div>
              <h1 style={styles.detailTitle}>{detailSkill.name}</h1>
              <div style={styles.detailSubtitle}>
                <span style={styles.cardId}>{detailSkill.id}</span>
                <span>v{detailSkill.version}</span>
                {detailSkill.system && (
                  <span style={{ ...styles.badge, ...styles.badgeSystem }}>System (nur lesen)</span>
                )}
                {detailSkill.hasWorkflow && (
                  <span style={{ ...styles.badge, ...styles.badgeWorkflow }}>Workflow</span>
                )}
                {detailSkill.hasOutput && (
                  <span style={{ ...styles.badge, ...styles.badgeOutput }}>Template</span>
                )}
                {!detailSkill.enabled && (
                  <span style={{ ...styles.badge, ...styles.badgeDisabled }}>Deaktiviert</span>
                )}
              </div>
            </div>
          </div>
          {/* Actions for custom skills */}
          {isCustomSkill && (
            <div style={styles.detailActions}>
              <button
                style={{ ...styles.headerButton, ...styles.headerButtonDanger }}
                onClick={handleDeleteFromHeader}
              >
                <TrashIcon /> Löschen
              </button>
              <button
                style={{ ...styles.headerButton, ...styles.headerButtonPrimary }}
                onClick={handleSaveFromHeader}
                disabled={isSaving}
              >
                <SaveIcon /> {isSaving ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div style={styles.error}>
            {error}
            <button
              onClick={() => setError(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.error }}
            >
              ✕
            </button>
          </div>
        )}

        {successMessage && (
          <div style={styles.success}>
            {successMessage}
            <button
              onClick={() => setSuccessMessage(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.textMuted }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Custom Skills: Inline Editor */}
        {isCustomSkill && editorSkill && (
          <SkillEditor
            ref={editorRef}
            skill={editorSkill}
            onSave={handleSaveSkill}
            onDelete={handleDeleteSkill}
            inline={true}
          />
        )}

        {/* System Skills: Read-only View */}
        {!isCustomSkill && (
          <div style={styles.detailContent}>
            {/* Description */}
            {detailSkill.description && (
              <div style={{ ...styles.detailCard, ...styles.detailCardFull }}>
                <h3 style={styles.detailCardTitle}>Beschreibung</h3>
                <p style={{ color: theme.colors.textSecondary, lineHeight: theme.typography.lineHeight.relaxed }}>
                  {detailSkill.description}
                </p>
              </div>
            )}

            {/* Metadata (NEW) */}
            {detailSkill.metadata?.use_when && (
              <div style={{ ...styles.detailCard, ...styles.detailCardFull }}>
                <h3 style={styles.detailCardTitle}>
                  <MetadataIcon /> Wann verwenden?
                </h3>
                <div style={styles.codeBlock}>
                  {detailSkill.metadata.use_when}
                </div>
                {(detailSkill.metadata.estimated_effort || detailSkill.metadata.output_type) && (
                  <div style={{ marginTop: theme.spacing.md, display: 'flex', gap: theme.spacing.lg }}>
                    {detailSkill.metadata.estimated_effort && (
                      <div>
                        <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>Aufwand: </span>
                        <span style={{ fontSize: theme.typography.sizes.sm }}>{detailSkill.metadata.estimated_effort}</span>
                      </div>
                    )}
                    {detailSkill.metadata.output_type && (
                      <div>
                        <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>Output: </span>
                        <span style={{ fontSize: theme.typography.sizes.sm }}>{detailSkill.metadata.output_type}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Allowed Tools (NEW) */}
            {detailSkill.allowed_tools?.length > 0 && (
              <div style={styles.detailCard}>
                <h3 style={styles.detailCardTitle}>
                  <ToolIcon /> Hinzugefügte Tools
                </h3>
                <div style={styles.tags}>
                  {detailSkill.allowed_tools.map((t, idx) => (
                    <span key={idx} style={{ ...styles.tag, ...styles.toolTag }}>{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Knowledge (NEW) */}
            {(detailSkill.knowledge?.files?.length > 0 || detailSkill.knowledge?.collections?.length > 0) && (
              <div style={styles.detailCard}>
                <h3 style={styles.detailCardTitle}>
                  <KnowledgeIcon /> Wissensreferenzen
                </h3>
                {detailSkill.knowledge.files?.length > 0 && (
                  <div style={{ marginBottom: theme.spacing.md }}>
                    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.sm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dateien</div>
                    <div style={styles.tags}>
                      {detailSkill.knowledge.files.map((f, idx) => (
                        <span key={idx} style={{ ...styles.tag, backgroundColor: '#10b98115', color: '#10b981', fontFamily: theme.typography.fontMono }}>{f}</span>
                      ))}
                    </div>
                  </div>
                )}
                {detailSkill.knowledge.collections?.length > 0 && (
                  <div>
                    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.sm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collections</div>
                    <div style={styles.tags}>
                      {detailSkill.knowledge.collections.map((c, idx) => (
                        <span key={idx} style={{ ...styles.tag, backgroundColor: '#3b82f615', color: '#3b82f6', fontFamily: theme.typography.fontMono }}>{c}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Legacy Triggers */}
            {(detailSkill.triggers?.keywords?.length > 0 || detailSkill.triggers?.patterns?.length > 0) && (
              <div style={styles.detailCard}>
                <h3 style={styles.detailCardTitle}>
                  <TriggerIcon /> Triggers <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, fontWeight: 'normal' }}>(Legacy)</span>
                </h3>
                {detailSkill.triggers.keywords?.length > 0 && (
                  <div style={{ marginBottom: theme.spacing.lg }}>
                    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.sm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Keywords</div>
                    <div style={styles.tags}>
                      {detailSkill.triggers.keywords.map((kw, idx) => (
                        <span key={idx} style={{ ...styles.tag, ...styles.keywordTag }}>{kw}</span>
                      ))}
                    </div>
                  </div>
                )}
                {detailSkill.triggers.patterns?.length > 0 && (
                  <div>
                    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.sm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Regex Patterns</div>
                    <div style={styles.codeBlock}>
                      {detailSkill.triggers.patterns.join('\n')}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Legacy Tools */}
            {(detailSkill.tools?.required?.length > 0 || detailSkill.tools?.optional?.length > 0) && (
              <div style={styles.detailCard}>
                <h3 style={styles.detailCardTitle}>
                  <ToolIcon /> Tools <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, fontWeight: 'normal' }}>(Legacy)</span>
                </h3>
                <div style={styles.tags}>
                  {detailSkill.tools.required?.map((t, idx) => (
                    <span key={`req-${idx}`} style={{ ...styles.tag, ...styles.toolTag }}>{t} (required)</span>
                  ))}
                  {detailSkill.tools.optional?.map((t, idx) => (
                    <span key={`opt-${idx}`} style={{ ...styles.tag, ...styles.toolTagOptional }}>{t} (optional)</span>
                  ))}
                </div>
              </div>
            )}

            {/* Workflow */}
            {detailSkill.workflow?.steps?.length > 0 && (
              <div style={{ ...styles.detailCard, ...styles.detailCardFull }}>
                <h3 style={styles.detailCardTitle}>
                  <WorkflowIcon /> Workflow ({detailSkill.workflow.steps.length} Steps)
                </h3>
                {detailSkill.workflow.steps.map((step, idx) => (
                  <div key={idx} style={styles.workflowStep}>
                    <div style={styles.stepNumber}>{idx + 1}</div>
                    <div style={styles.stepContent}>
                      <div style={styles.stepAction}>
                        {step.action === 'tool' && `Tool: ${step.tool}`}
                        {step.action === 'think' && 'Analysieren'}
                        {step.action === 'respond' && 'Antworten'}
                        {step.action === 'delegate' && 'Delegieren'}
                      </div>
                      {step.description && (
                        <div style={styles.stepDescription}>{step.description}</div>
                      )}
                      {step.condition && (
                        <div style={{ ...styles.stepDescription, fontStyle: 'italic' }}>
                          Bedingung: {step.condition}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Instructions */}
            {detailSkill.instructions && (
              <div style={{ ...styles.detailCard, ...styles.detailCardFull }}>
                <h3 style={styles.detailCardTitle}>
                  <DocumentIcon /> Instructions
                </h3>
                <div style={styles.codeBlock}>
                  {detailSkill.instructions}
                </div>
              </div>
            )}

            {/* Output Template */}
            {detailSkill.output?.template && (
              <div style={{ ...styles.detailCard, ...styles.detailCardFull }}>
                <h3 style={styles.detailCardTitle}>
                  <TemplateIcon /> Output Template
                </h3>
                <div style={styles.codeBlock}>
                  {detailSkill.output.template}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Editor (for new skills only) */}
        {showEditor && (
          <SkillEditor
            skill={editorSkill}
            onSave={handleSaveSkill}
            onClose={closeEditor}
            onDelete={handleDeleteSkill}
          />
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER: Overview (Default)
  // ==========================================

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>Enhanced Skills</h1>
          <p style={styles.subtitle}>
            Skills erweitern Agenten mit spezialisierten Anweisungen, Tools und Workflows.
          </p>
        </div>
        <div style={styles.headerActions}>
          <button
            style={styles.reloadButton}
            onClick={reloadSkills}
            onMouseOver={(e) => e.currentTarget.style.borderColor = '#8b5cf6'}
            onMouseOut={(e) => e.currentTarget.style.borderColor = theme.colors.border}
          >
            <ReloadIcon />
            Neu laden
          </button>
          <button
            style={styles.createButton}
            onClick={() => openEditor(null)}
          >
            <PlusIcon />
            Neuer Skill
          </button>
        </div>
      </div>

      {error && (
        <div style={styles.error}>
          {error}
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.error }}
          >
            ✕
          </button>
        </div>
      )}

      <div style={styles.searchContainer}>
        <input
          style={styles.searchInput}
          type="text"
          placeholder="Skills durchsuchen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredSkills.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '48px', marginBottom: theme.spacing.md, opacity: 0.5 }}>
            <SkillIcon />
          </div>
          <div style={{ fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold, marginBottom: theme.spacing.sm }}>
            {searchQuery ? 'Keine Skills gefunden' : 'Keine Skills vorhanden'}
          </div>
          <div style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.lg }}>
            {searchQuery
              ? 'Versuche einen anderen Suchbegriff.'
              : 'Erstelle YAML-Dateien in data/skills/custom/ um Skills hinzuzufügen.'
            }
          </div>
        </div>
      ) : (
        <>
          {/* Custom Skills Section */}
          {customSkills.length > 0 && (
            <>
              <div style={{ ...styles.sectionHeader, ...styles.sectionHeaderFirst }}>
                <div style={styles.sectionHeaderTitle}>Custom Skills ({customSkills.length})</div>
                <div style={styles.sectionHeaderSubtitle}>Von dir erstellte und bearbeitbare Skills</div>
              </div>
              <div style={styles.grid}>
                {customSkills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    onView={viewSkillDetails}
                    onEdit={openEditor}
                  />
                ))}
              </div>
            </>
          )}

          {/* System Skills Section */}
          {systemSkills.length > 0 && (
            <>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionHeaderTitle}>System Skills ({systemSkills.length})</div>
                <div style={styles.sectionHeaderSubtitle}>Vom System bereitgestellte Skills (nicht bearbeitbar)</div>
              </div>
              <div style={styles.grid}>
                {systemSkills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    onView={viewSkillDetails}
                    onEdit={null}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div style={styles.hint}>
        <strong>Hinweis:</strong> Skills werden als YAML-Dateien in{' '}
        <code style={styles.code}>data/skills/custom/[skill-id]/SKILL.yaml</code> verwaltet.
        Änderungen erfordern einen Neustart oder "Neu laden".
      </div>

      {/* Skill Editor */}
      {showEditor && (
        <SkillEditor
          skill={editorSkill}
          onSave={handleSaveSkill}
          onClose={closeEditor}
          onDelete={handleDeleteSkill}
        />
      )}
    </div>
  );
}

// Icons
function SkillIcon({ color = 'currentColor', size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function WorkflowIcon({ color = 'currentColor', size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function ReloadIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function EyeIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PlusIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function EditIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function ArrowLeftIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function TriggerIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function ToolIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function DocumentIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function TemplateIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}

function MetadataIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function KnowledgeIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function TrashIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function SaveIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

export default SkillsPage;
