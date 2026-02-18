import { useState, useEffect } from 'react';
import { theme } from '../config/theme';
import { PlugIcon } from '../components/Icons';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
  addButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  tabs: {
    display: 'flex',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
    borderBottom: `1px solid ${theme.colors.border}`,
    paddingBottom: theme.spacing.md,
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
  stats: {
    display: 'flex',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  statCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.lg,
    flex: 1,
    textAlign: 'center',
  },
  statValue: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sectionBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
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
    width: '44px',
    height: '44px',
    borderRadius: theme.borderRadius.lg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  cardMeta: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: '2px',
    fontFamily: theme.typography.fontMono,
  },
  cardDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.relaxed,
    marginBottom: theme.spacing.md,
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.border}`,
  },
  statusBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  statusAvailable: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  statusUnavailable: {
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
  },
  configHint: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontMono,
  },
  configLink: {
    color: theme.colors.primary,
    textDecoration: 'none',
    marginLeft: theme.spacing.xs,
  },
  statusDisabled: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
  },
  methodBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontMono,
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
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
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
    zIndex: 1000,
    padding: theme.spacing.xl,
  },
  modal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    width: '100%',
    maxWidth: '700px',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: theme.shadows.xl,
  },
  modalHeader: {
    padding: theme.spacing.xl,
    borderBottom: `1px solid ${theme.colors.border}`,
    position: 'sticky',
    top: 0,
    backgroundColor: theme.colors.surface,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  modalBody: {
    padding: theme.spacing.xl,
  },
  modalFooter: {
    padding: theme.spacing.xl,
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    position: 'sticky',
    bottom: 0,
    backgroundColor: theme.colors.surface,
  },
  formSection: {
    marginBottom: theme.spacing.xl,
  },
  formSectionTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.md,
  },
  formGroup: {
    marginBottom: theme.spacing.md,
  },
  label: {
    display: 'block',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
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
  inputMono: {
    fontFamily: theme.typography.fontMono,
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
  },
  textarea: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    resize: 'vertical',
    minHeight: '100px',
    fontFamily: theme.typography.fontMono,
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  parameterList: {
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  parameterItem: {
    display: 'grid',
    gridTemplateColumns: '1fr 100px 100px 80px 40px',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.border}`,
    alignItems: 'center',
  },
  parameterHeader: {
    backgroundColor: theme.colors.surfaceHover,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  addParamButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: 'transparent',
    border: 'none',
    color: theme.colors.primary,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.sm,
    width: '100%',
    justifyContent: 'center',
  },
  removeButton: {
    padding: theme.spacing.xs,
    backgroundColor: 'transparent',
    border: 'none',
    color: theme.colors.textMuted,
    cursor: 'pointer',
    borderRadius: theme.borderRadius.sm,
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
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  testButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  testResult: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontMono,
    whiteSpace: 'pre-wrap',
    maxHeight: '200px',
    overflow: 'auto',
  },
  testSuccess: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  testError: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
  },
};

const typeColors = {
  local: { bg: '#10b98120', color: '#10b981' },
  api: { bg: '#3b82f620', color: '#3b82f6' },
  mcp: { bg: '#8b5cf620', color: '#8b5cf6' },
  delegation: { bg: '#f59e0b20', color: '#f59e0b' },
  custom: { bg: '#ec489920', color: '#ec4899' },
};

const methodColors = {
  GET: { bg: '#10b98120', color: '#10b981' },
  POST: { bg: '#3b82f620', color: '#3b82f6' },
  PUT: { bg: '#f59e0b20', color: '#f59e0b' },
  DELETE: { bg: '#ef444420', color: '#ef4444' },
  PATCH: { bg: '#8b5cf620', color: '#8b5cf6' },
};

const defaultFormData = {
  id: '',
  name: '',
  description: '',
  category: 'custom',
  enabled: true,
  endpoint: '',
  method: 'GET',
  parameters: [],
  auth: { type: 'none', location: 'header', keyName: '', envVar: '' },
  responseType: 'json',
  responseTemplate: '',
  bodyTemplate: '',
};

function ToolsPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [tools, setTools] = useState([]);
  const [customTools, setCustomTools] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  const fetchTools = async () => {
    try {
      const [toolsRes, customRes] = await Promise.all([
        fetch(`${API_URL}/tools`),
        fetch(`${API_URL}/custom-tools`),
      ]);

      if (!toolsRes.ok) throw new Error('Failed to fetch tools');
      if (!customRes.ok) throw new Error('Failed to fetch custom tools');

      const toolsData = await toolsRes.json();
      const customData = await customRes.json();

      setTools(toolsData.tools || []);
      setCustomTools(customData.tools || []);
      setStats(toolsData.stats || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  const handleCreate = () => {
    setEditingTool(null);
    setFormData({ ...defaultFormData });
    setTestResult(null);
    setShowModal(true);
  };

  const handleEdit = async (tool) => {
    try {
      const response = await fetch(`${API_URL}/custom-tools/${tool.id}`);
      if (!response.ok) throw new Error('Failed to load tool');
      const data = await response.json();

      setEditingTool(data);
      setFormData({
        ...defaultFormData,
        ...data,
        auth: { ...defaultFormData.auth, ...data.auth },
      });
      setTestResult(null);
      setShowModal(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (toolId) => {
    if (!confirm(`Möchten Sie das Tool "${toolId}" wirklich löschen?`)) return;

    try {
      const response = await fetch(`${API_URL}/custom-tools/${toolId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete tool');
      }

      await fetchTools();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggle = async (toolId) => {
    try {
      const response = await fetch(`${API_URL}/custom-tools/${toolId}/toggle`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to toggle tool');
      }

      await fetchTools();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSave = async () => {
    try {
      const url = editingTool
        ? `${API_URL}/custom-tools/${editingTool.id}`
        : `${API_URL}/custom-tools`;

      const response = await fetch(url, {
        method: editingTool ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save tool');
      }

      setShowModal(false);
      await fetchTools();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTest = async () => {
    if (!editingTool) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      // Build test parameters from required params
      const testParams = {};
      for (const param of formData.parameters) {
        if (param.required) {
          testParams[param.name] = param.default || `test_${param.name}`;
        }
      }

      const response = await fetch(`${API_URL}/custom-tools/${editingTool.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameters: testParams }),
      });

      const data = await response.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const addParameter = () => {
    setFormData({
      ...formData,
      parameters: [
        ...formData.parameters,
        { name: '', type: 'string', description: '', required: false, location: 'query' },
      ],
    });
  };

  const updateParameter = (index, field, value) => {
    const params = [...formData.parameters];
    params[index] = { ...params[index], [field]: value };
    setFormData({ ...formData, parameters: params });
  };

  const removeParameter = (index) => {
    const params = formData.parameters.filter((_, i) => i !== index);
    setFormData({ ...formData, parameters: params });
  };

  // Filter tools based on active tab
  const displayTools = activeTab === 'all' ? tools : [];
  const displayCustomTools = activeTab === 'all' || activeTab === 'custom' ? customTools : [];

  if (isLoading) {
    return <div style={styles.loading}>Lade Tools...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>Tools</h1>
          <p style={styles.subtitle}>
            Verwalte System-Tools und erstelle eigene API-Integrationen.
          </p>
        </div>
        <button
          style={styles.addButton}
          onClick={handleCreate}
          onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
          onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
        >
          <PlusIcon />
          Neues API-Tool
        </button>
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

      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(activeTab === 'all' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('all')}
        >
          Alle Tools
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'custom' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('custom')}
        >
          Eigene API-Tools ({customTools.length})
        </button>
      </div>

      {stats && activeTab === 'all' && (
        <div style={styles.stats}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.total}</div>
            <div style={styles.statLabel}>System-Tools</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statValue, color: '#ec4899' }}>{customTools.length}</div>
            <div style={styles.statLabel}>Eigene Tools</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statValue, color: theme.colors.success }}>
              {stats.available + customTools.filter((t) => t.enabled).length}
            </div>
            <div style={styles.statLabel}>Verfügbar</div>
          </div>
        </div>
      )}

      {/* System Tools */}
      {activeTab === 'all' && displayTools.length > 0 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>
            System-Tools
            <span style={styles.sectionBadge}>{displayTools.length}</span>
          </h2>
          <div style={styles.grid}>
            {displayTools.map((tool) => {
              const colors = typeColors[tool.type] || typeColors.local;
              return (
                <div key={tool.name} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <div style={{ ...styles.cardIcon, backgroundColor: colors.bg }}>
                      <ToolIcon type={tool.type} color={colors.color} />
                    </div>
                    <div>
                      <div style={styles.cardTitle}>{tool.name}</div>
                      <div style={styles.cardMeta}>{tool.type}</div>
                    </div>
                  </div>
                  <p style={styles.cardDescription}>{tool.description}</p>
                  <div style={styles.cardFooter}>
                    <div>
                      <span
                        style={{
                          ...styles.statusBadge,
                          ...(tool.available ? styles.statusAvailable : styles.statusUnavailable),
                        }}
                      >
                        {tool.available ? 'Verfügbar' : 'Nicht konfiguriert'}
                      </span>
                      {!tool.available && tool.envVar && (
                        <div style={styles.configHint}>
                          Setze {tool.envVar} in .env
                          {tool.docUrl && (
                            <a
                              href={tool.docUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={styles.configLink}
                            >
                              API Key holen →
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom Tools */}
      {displayCustomTools.length > 0 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>
            <span style={{ color: '#ec4899' }}>●</span>
            Eigene API-Tools
            <span style={styles.sectionBadge}>{displayCustomTools.length}</span>
          </h2>
          <div style={styles.grid}>
            {displayCustomTools.map((tool) => {
              const methodColor = methodColors[tool.method] || methodColors.GET;
              return (
                <div
                  key={tool.id}
                  style={styles.card}
                  onMouseOver={(e) => {
                    e.currentTarget.style.boxShadow = theme.shadows.lg;
                    e.currentTarget.style.borderColor = '#ec4899';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = theme.colors.border;
                  }}
                >
                  <div style={styles.cardHeader}>
                    <div style={{ ...styles.cardIcon, backgroundColor: '#ec489920' }}>
                      <CustomToolIcon color="#ec4899" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={styles.cardTitle}>{tool.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginTop: '4px' }}>
                        <span
                          style={{
                            ...styles.methodBadge,
                            backgroundColor: methodColor.bg,
                            color: methodColor.color,
                          }}
                        >
                          {tool.method}
                        </span>
                        <span style={styles.cardMeta}>{tool.id}</span>
                      </div>
                    </div>
                  </div>
                  <p style={styles.cardDescription}>{tool.description}</p>
                  <div style={styles.cardFooter}>
                    <span
                      style={{
                        ...styles.statusBadge,
                        ...(tool.enabled ? styles.statusAvailable : styles.statusDisabled),
                      }}
                    >
                      {tool.enabled ? 'Aktiv' : 'Deaktiviert'}
                    </span>
                    <div style={styles.cardActions}>
                      <button
                        style={styles.actionButton}
                        onClick={() => handleToggle(tool.id)}
                        title={tool.enabled ? 'Deaktivieren' : 'Aktivieren'}
                      >
                        {tool.enabled ? <ToggleOnIcon /> : <ToggleOffIcon />}
                      </button>
                      <button
                        style={styles.actionButton}
                        onClick={() => handleEdit(tool)}
                        onMouseOver={(e) => (e.currentTarget.style.color = theme.colors.primary)}
                        onMouseOut={(e) => (e.currentTarget.style.color = theme.colors.textMuted)}
                        title="Bearbeiten"
                      >
                        <EditIcon />
                      </button>
                      <button
                        style={styles.actionButton}
                        onClick={() => handleDelete(tool.id)}
                        onMouseOver={(e) => (e.currentTarget.style.color = theme.colors.error)}
                        onMouseOut={(e) => (e.currentTarget.style.color = theme.colors.textMuted)}
                        title="Löschen"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'custom' && customTools.length === 0 && (
        <div style={styles.emptyState}>
          <div style={{ marginBottom: theme.spacing.md, opacity: 0.5, color: theme.colors.textMuted }}>
            <PlugIcon size={48} />
          </div>
          <div style={{ fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold, marginBottom: theme.spacing.sm }}>
            Keine eigenen Tools
          </div>
          <div style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.lg }}>
            Erstelle eigene API-Tools um externe Services zu integrieren.
          </div>
          <button style={styles.addButton} onClick={handleCreate}>
            <PlusIcon />
            Erstes Tool erstellen
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingTool ? 'API-Tool bearbeiten' : 'Neues API-Tool erstellen'}
              </h2>
            </div>

            <div style={styles.modalBody}>
              {/* Basic Info */}
              <div style={styles.formSection}>
                <div style={styles.formSectionTitle}>Grundeinstellungen</div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>ID</label>
                    <input
                      style={{ ...styles.input, ...styles.inputMono }}
                      value={formData.id}
                      onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                      placeholder="weather-api"
                      disabled={!!editingTool}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Name</label>
                    <input
                      style={styles.input}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Wetter Abfrage"
                    />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Beschreibung</label>
                  <input
                    style={styles.input}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Beschreibung für das LLM..."
                  />
                  <div style={styles.hint}>Diese Beschreibung hilft dem LLM zu verstehen, wann das Tool verwendet werden soll.</div>
                </div>
              </div>

              {/* API Configuration */}
              <div style={styles.formSection}>
                <div style={styles.formSectionTitle}>API-Konfiguration</div>
                <div style={styles.formRow}>
                  <div style={{ ...styles.formGroup, flex: 2 }}>
                    <label style={styles.label}>Endpoint URL</label>
                    <input
                      style={{ ...styles.input, ...styles.inputMono }}
                      value={formData.endpoint}
                      onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                      placeholder="https://api.example.com/v1/data"
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Methode</label>
                    <select
                      style={styles.select}
                      value={formData.method}
                      onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Parameters */}
              <div style={styles.formSection}>
                <div style={styles.formSectionTitle}>Parameter</div>
                <div style={styles.parameterList}>
                  <div style={{ ...styles.parameterItem, ...styles.parameterHeader }}>
                    <span>Name</span>
                    <span>Typ</span>
                    <span>Position</span>
                    <span>Pflicht</span>
                    <span></span>
                  </div>
                  {formData.parameters.map((param, index) => (
                    <div key={index} style={styles.parameterItem}>
                      <input
                        style={{ ...styles.input, ...styles.inputMono }}
                        value={param.name}
                        onChange={(e) => updateParameter(index, 'name', e.target.value)}
                        placeholder="param_name"
                      />
                      <select
                        style={styles.select}
                        value={param.type}
                        onChange={(e) => updateParameter(index, 'type', e.target.value)}
                      >
                        <option value="string">String</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                      </select>
                      <select
                        style={styles.select}
                        value={param.location}
                        onChange={(e) => updateParameter(index, 'location', e.target.value)}
                      >
                        <option value="query">Query</option>
                        <option value="path">Path</option>
                        <option value="header">Header</option>
                        <option value="body">Body</option>
                      </select>
                      <input
                        type="checkbox"
                        checked={param.required}
                        onChange={(e) => updateParameter(index, 'required', e.target.checked)}
                        style={{ width: 'auto', cursor: 'pointer' }}
                      />
                      <button style={styles.removeButton} onClick={() => removeParameter(index)}>
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  ))}
                  <button style={styles.addParamButton} onClick={addParameter}>
                    <PlusIcon size={16} />
                    Parameter hinzufügen
                  </button>
                </div>
              </div>

              {/* Authentication */}
              <div style={styles.formSection}>
                <div style={styles.formSectionTitle}>Authentifizierung</div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Typ</label>
                    <select
                      style={styles.select}
                      value={formData.auth.type}
                      onChange={(e) => setFormData({ ...formData, auth: { ...formData.auth, type: e.target.value } })}
                    >
                      <option value="none">Keine</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="api-key">API Key</option>
                      <option value="basic">Basic Auth</option>
                    </select>
                  </div>
                  {formData.auth.type !== 'none' && (
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Env Variable</label>
                      <input
                        style={{ ...styles.input, ...styles.inputMono }}
                        value={formData.auth.envVar || ''}
                        onChange={(e) => setFormData({ ...formData, auth: { ...formData.auth, envVar: e.target.value } })}
                        placeholder="MY_API_KEY"
                      />
                    </div>
                  )}
                </div>
                {formData.auth.type === 'api-key' && (
                  <div style={styles.formRow}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Key Name</label>
                      <input
                        style={{ ...styles.input, ...styles.inputMono }}
                        value={formData.auth.keyName || ''}
                        onChange={(e) => setFormData({ ...formData, auth: { ...formData.auth, keyName: e.target.value } })}
                        placeholder="X-API-Key"
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Position</label>
                      <select
                        style={styles.select}
                        value={formData.auth.location || 'header'}
                        onChange={(e) => setFormData({ ...formData, auth: { ...formData.auth, location: e.target.value } })}
                      >
                        <option value="header">Header</option>
                        <option value="query">Query Parameter</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Response */}
              <div style={styles.formSection}>
                <div style={styles.formSectionTitle}>Response Verarbeitung</div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Response Template (optional)</label>
                  <textarea
                    style={styles.textarea}
                    value={formData.responseTemplate || ''}
                    onChange={(e) => setFormData({ ...formData, responseTemplate: e.target.value })}
                    placeholder="Ergebnis: {{result.value}} - {{result.description}}"
                  />
                  <div style={styles.hint}>
                    Verwende {'{{field}}'} oder {'{{nested.field}}'} um Werte aus der API-Response einzufügen.
                  </div>
                </div>
              </div>

              {/* Test */}
              {editingTool && (
                <div style={styles.formSection}>
                  <div style={styles.formSectionTitle}>Tool testen</div>
                  <button
                    style={styles.testButton}
                    onClick={handleTest}
                    disabled={isTesting}
                  >
                    {isTesting ? 'Teste...' : 'Test ausführen'}
                  </button>
                  {testResult && (
                    <div
                      style={{
                        ...styles.testResult,
                        ...(testResult.success ? styles.testSuccess : styles.testError),
                      }}
                    >
                      {testResult.success
                        ? testResult.response
                        : `Fehler: ${testResult.error}`}
                      {testResult.duration && (
                        <div style={{ marginTop: theme.spacing.sm, opacity: 0.7 }}>
                          Dauer: {testResult.duration}ms
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button style={styles.cancelButton} onClick={() => setShowModal(false)}>
                Abbrechen
              </button>
              <button style={styles.saveButton} onClick={handleSave}>
                {editingTool ? 'Speichern' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Icons
function PlusIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
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

function TrashIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ToggleOnIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.colors.success} strokeWidth="2">
      <rect x="1" y="5" width="22" height="14" rx="7" ry="7" />
      <circle cx="16" cy="12" r="3" fill={theme.colors.success} />
    </svg>
  );
}

function ToggleOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="1" y="5" width="22" height="14" rx="7" ry="7" />
      <circle cx="8" cy="12" r="3" />
    </svg>
  );
}

function ToolIcon({ type, color = 'currentColor', size = 20 }) {
  switch (type) {
    case 'local':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'api':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case 'delegation':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <polyline points="17 11 19 13 23 9" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
  }
}

function CustomToolIcon({ color = 'currentColor', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export default ToolsPage;
